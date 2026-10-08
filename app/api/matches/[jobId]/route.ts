import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, ApiError, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  builderProfiles,
  jobs,
  matchResults,
  portfolioProjects,
} from "@/lib/db/schema";

export const runtime = "nodejs";

function normalize(value: string) {
  return value.toLocaleLowerCase().trim();
}

function overlapScore(required: string[], offered: string[]) {
  if (required.length === 0) return 70;
  const available = new Set(offered.map(normalize));
  const hits = required.filter((item) => available.has(normalize(item))).length;
  return Math.round((hits / required.length) * 100);
}

function budgetScore(
  requestedMin: number | null,
  requestedMax: number | null,
  preferredMin: number | null,
  preferredMax: number | null,
) {
  if (requestedMin === null && requestedMax === null) return 70;
  if (preferredMin === null && preferredMax === null) return 65;
  const lowerA = requestedMin ?? 0;
  const upperA = requestedMax ?? Number.MAX_SAFE_INTEGER;
  const lowerB = preferredMin ?? 0;
  const upperB = preferredMax ?? Number.MAX_SAFE_INTEGER;
  if (lowerA <= upperB && lowerB <= upperA) return 100;
  const gap = Math.max(lowerA - upperB, lowerB - upperA, 0);
  const baseline = Math.max(upperA === Number.MAX_SAFE_INTEGER ? lowerA : upperA, lowerB, 1);
  return Math.max(0, 100 - Math.round((gap / baseline) * 100));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const { jobId: rawJobId } = await params;
    const jobId = requireUuid(rawJobId, "ID lowongan");
    const db = getDb();
    const [profile] = await db
      .select()
      .from(builderProfiles)
      .where(eq(builderProfiles.userId, currentUser.id))
      .limit(1);
    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Lengkapi profil builder sebelum menghitung kecocokan.");

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");
    if (job.status !== "open" && job.status !== "closed") {
      if (currentUser.role !== "admin" && currentUser.id !== job.clientId) {
        throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");
      }
    }

    const portfolio = await db
      .select({
        category: portfolioProjects.category,
        style: portfolioProjects.style,
      })
      .from(portfolioProjects)
      .where(
        and(
          eq(portfolioProjects.builderId, profile.id),
          eq(portfolioProjects.isPublic, true),
        ),
      );
    const portfolioTerms = portfolio.flatMap((project) => [project.category, ...project.style]);
    const combinedStyles = [...profile.styles, ...profile.projectTypes];
    const skillScore = overlapScore(job.requiredSkills, profile.skills);
    const projectTypeScore = overlapScore(
      job.projectType ? [job.projectType] : [],
      profile.projectTypes,
    );
    const styleScore = overlapScore(job.style, combinedStyles);
    const preferredTerms = [
      ...profile.skills,
      ...profile.styles,
      ...profile.projectTypes,
      ...profile.tools,
    ];
    const portfolioScore = overlapScore(
      [...(job.projectType ? [job.projectType] : []), ...job.style],
      portfolioTerms,
    );
    const complexityScore =
      !job.complexity || !profile.experience
        ? 70
        : normalize(profile.experience).includes(normalize(job.complexity))
          ? 100
          : 55;
    const canCompareBudget = job.currency === "IDR";
    const scoreBudget = canCompareBudget
      ? budgetScore(
          job.budgetMin,
          job.budgetMax,
          profile.preferredBudgetMin,
          profile.preferredBudgetMax,
        )
      : 70;
    const score = Math.round(
      skillScore * 0.25 +
        projectTypeScore * 0.15 +
        styleScore * 0.2 +
        scoreBudget * 0.1 +
        complexityScore * 0.1 +
        portfolioScore * 0.2,
    );
    const matchingSkills = job.requiredSkills.filter((skill) =>
      preferredTerms.some((term) => normalize(term) === normalize(skill)),
    );
    const missingRequirements = job.requiredSkills.filter(
      (skill) => !matchingSkills.some((match) => normalize(match) === normalize(skill)),
    );
    const strengths = [
      ...(matchingSkills.length ? [`Keahlian relevan: ${matchingSkills.join(", ")}`] : []),
      ...(job.style.filter((style) =>
        combinedStyles.some((item) => normalize(item) === normalize(style)),
      ).length
        ? ["Gaya proyek sesuai preferensi profil"]
        : []),
      ...(portfolioTerms.length ? ["Portfolio publik tersedia untuk dibandingkan"] : []),
    ];
    const reasons = [
      `Kecocokan keahlian ${skillScore}%.`,
      `Kecocokan gaya ${styleScore}% dan portfolio ${portfolioScore}%.`,
      canCompareBudget
        ? `Kecocokan budget ${scoreBudget}%.`
        : `Budget menggunakan ${job.currency} dan tidak dibandingkan tanpa konversi.`,
    ];
    const risks = [
      ...(missingRequirements.length
        ? [`Persyaratan yang belum tercantum di profil: ${missingRequirements.join(", ")}`]
        : []),
      ...(!job.budgetNegotiable && job.budgetMin === null && job.budgetMax === null
        ? ["Klien belum menetapkan kisaran budget."]
        : []),
      ...(!canCompareBudget
        ? [`Budget lowongan menggunakan ${job.currency}; skor budget bersifat netral karena belum dikonversi ke IDR.`]
        : []),
    ];

    const [result] = await db
      .insert(matchResults)
      .values({
        jobId,
        builderId: profile.id,
        score,
        skillScore,
        projectTypeScore,
        styleScore,
        budgetScore: scoreBudget,
        complexityScore,
        portfolioScore,
        missingRequirements,
        strengths,
        reasons,
        risks,
      })
      .onConflictDoUpdate({
        target: [matchResults.jobId, matchResults.builderId],
        set: {
          score,
          skillScore,
          projectTypeScore,
          styleScore,
          budgetScore: scoreBudget,
          complexityScore,
          portfolioScore,
          missingRequirements,
          strengths,
          reasons,
          risks,
          generatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ data: result });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
