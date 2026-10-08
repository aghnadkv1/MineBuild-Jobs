import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, pagination, requireRole, requireUser, ApiError, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, jobs, matchResults, user } from "@/lib/db/schema";
import { jobInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = pagination(searchParams);
    const query = searchParams.get("q")?.trim().slice(0, 120);
    const category = searchParams.get("category")?.trim().slice(0, 80);
    const version = searchParams.get("version")?.trim().slice(0, 40);
    const skill = searchParams.get("skill")?.trim().slice(0, 80);
    const complexity = searchParams.get("complexity")?.trim().slice(0, 20);
    const deadlineBefore = searchParams.get("deadlineBefore");
    const minBudget = Number(searchParams.get("budgetMin"));
    const maxBudget = Number(searchParams.get("budgetMax"));
    const source = searchParams.get("source")?.trim().toLowerCase();
    const requestedStatus = searchParams.get("status") ?? "open";
    if (requestedStatus !== "open" && requestedStatus !== "closed") {
      throw new ApiError(400, "INVALID_STATUS", "Status publik yang didukung hanya open atau closed.");
    }
    const status = requestedStatus;
    const sort = searchParams.get("sort") ?? "newest";
    const supportedSorts = ["newest", "oldest", "budget_high", "budget_low", "deadline", "match"];
    if (!supportedSorts.includes(sort)) {
      throw new ApiError(400, "INVALID_SORT", "Pilihan urutkan lowongan tidak valid.");
    }

    const conditions = [eq(jobs.status, status)];
    if (source) {
      if (!["minebuild", "upwork", "fiverr"].includes(source)) {
        throw new ApiError(400, "INVALID_JOB_SOURCE", "Sumber lowongan tidak valid.");
      }
      conditions.push(eq(jobs.source, source));
    }
    if (query) {
      const escaped = query.replace(/[%_\\]/g, "\\$&");
      const pattern = `%${escaped}%`;
      conditions.push(
        or(
          ilike(jobs.title, pattern),
          ilike(jobs.description, pattern),
          ilike(jobs.projectType, pattern),
          sql`${pattern} = ANY(${jobs.requiredSkills})`,
          sql`${pattern} = ANY(${jobs.style})`,
        )!,
      );
    }
    if (category && category !== "Semua Gaya") {
      const escapedCategory = category.replace(/[%_\\]/g, "\\$&");
      conditions.push(
        or(
          ilike(jobs.projectType, `%${escapedCategory}%`),
          ilike(sql`array_to_string(${jobs.style}, ' ')`, `%${escapedCategory}%`),
          ilike(sql`array_to_string(${jobs.requiredSkills}, ' ')`, `%${escapedCategory}%`),
        )!,
      );
    }
    if (version) conditions.push(ilike(jobs.minecraftVersion, `%${version}%`));
    if (skill) {
      const escapedSkill = skill.replace(/[%_\\]/g, "\\$&");
      conditions.push(
        ilike(sql`array_to_string(${jobs.requiredSkills}, ' ')`, `%${escapedSkill}%`),
      );
    }
    if (complexity) conditions.push(eq(jobs.complexity, complexity));
    if (deadlineBefore) {
      const parsedDeadline = new Date(`${deadlineBefore}T00:00:00.000Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineBefore) || Number.isNaN(parsedDeadline.valueOf())) {
        throw new ApiError(400, "INVALID_DEADLINE", "Filter tenggat harus memakai format YYYY-MM-DD.");
      }
      conditions.push(lte(jobs.deadline, deadlineBefore));
    }
    if (Number.isFinite(minBudget) && minBudget >= 0) {
      conditions.push(or(gte(jobs.budgetMax, minBudget), eq(jobs.budgetNegotiable, true))!);
    }
    if (Number.isFinite(maxBudget) && maxBudget >= 0) {
      conditions.push(or(lte(jobs.budgetMin, maxBudget), eq(jobs.budgetNegotiable, true))!);
    }

    const orderBy =
      sort === "oldest"
        ? asc(jobs.postedAt)
        : sort === "budget_high"
          ? desc(jobs.budgetMax)
          : sort === "budget_low"
            ? asc(jobs.budgetMin)
            : sort === "deadline"
              ? asc(jobs.deadline)
              : desc(jobs.postedAt);

    const db = getDb();
    if (sort === "match") {
      const currentUser = await requireRole(request, ["builder", "admin"]);
      const [profile] = await db
        .select({ id: builderProfiles.id })
        .from(builderProfiles)
        .where(eq(builderProfiles.userId, currentUser.id))
        .limit(1);
      if (!profile) {
        throw new ApiError(409, "PROFILE_REQUIRED", "Buat profil builder sebelum mengurutkan berdasarkan match.");
      }
      const [rows, countRows] = await Promise.all([
        db
          .select({
            id: jobs.id,
            title: jobs.title,
            description: jobs.description,
            projectType: jobs.projectType,
            style: jobs.style,
            minecraftVersion: jobs.minecraftVersion,
            requiredSkills: jobs.requiredSkills,
            budgetMin: jobs.budgetMin,
            budgetMax: jobs.budgetMax,
            budgetNegotiable: jobs.budgetNegotiable,
            deadline: jobs.deadline,
            complexity: jobs.complexity,
            estimatedSize: jobs.estimatedSize,
            deliverables: jobs.deliverables,
            referenceUrls: jobs.referenceUrls,
            source: jobs.source,
            externalId: jobs.externalId,
            sourceUrl: jobs.sourceUrl,
            discoveredAt: jobs.discoveredAt,
            currency: jobs.currency,
            pricingType: jobs.pricingType,
            sourceStatus: jobs.sourceStatus,
            sourceClientInfo: jobs.sourceClientInfo,
            projectDuration: jobs.projectDuration,
            experienceLevel: jobs.experienceLevel,
            applicantsCount: jobs.applicantsCount,
            status: jobs.status,
            postedAt: jobs.postedAt,
            clientId: jobs.clientId,
            clientName: user.name,
            matchScore: matchResults.score,
          })
          .from(jobs)
          .leftJoin(user, eq(jobs.clientId, user.id))
          .leftJoin(
            matchResults,
            and(eq(matchResults.jobId, jobs.id), eq(matchResults.builderId, profile.id)),
          )
          .where(and(...conditions))
          .orderBy(sql`${matchResults.score} desc nulls last`, desc(jobs.postedAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(and(...conditions)),
      ]);
      return NextResponse.json({
        data: rows,
        pagination: { limit, offset, total: countRows[0]?.count ?? 0 },
      });
    }

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: jobs.id,
          title: jobs.title,
          description: jobs.description,
          projectType: jobs.projectType,
          style: jobs.style,
          minecraftVersion: jobs.minecraftVersion,
          requiredSkills: jobs.requiredSkills,
          budgetMin: jobs.budgetMin,
          budgetMax: jobs.budgetMax,
          budgetNegotiable: jobs.budgetNegotiable,
          deadline: jobs.deadline,
          complexity: jobs.complexity,
          estimatedSize: jobs.estimatedSize,
          deliverables: jobs.deliverables,
          referenceUrls: jobs.referenceUrls,
          source: jobs.source,
          externalId: jobs.externalId,
          sourceUrl: jobs.sourceUrl,
          discoveredAt: jobs.discoveredAt,
          currency: jobs.currency,
          pricingType: jobs.pricingType,
          sourceStatus: jobs.sourceStatus,
          sourceClientInfo: jobs.sourceClientInfo,
          projectDuration: jobs.projectDuration,
          experienceLevel: jobs.experienceLevel,
          applicantsCount: jobs.applicantsCount,
          status: jobs.status,
          postedAt: jobs.postedAt,
          clientId: jobs.clientId,
          clientName: user.name,
        })
        .from(jobs)
        .leftJoin(user, eq(jobs.clientId, user.id))
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(and(...conditions)),
    ]);

    return NextResponse.json({
      data: rows,
      pagination: { limit, offset, total: countRows[0]?.count ?? 0 },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireUser(request);
    if (currentUser.role !== "client" && currentUser.role !== "admin") {
      throw new ApiError(403, "FORBIDDEN", "Hanya akun klien yang dapat memasang lowongan.");
    }
    const input = jobInput.parse(await readJson(request));
    if (
      input.budgetMin !== null &&
      input.budgetMin !== undefined &&
      input.budgetMax !== null &&
      input.budgetMax !== undefined &&
      input.budgetMin > input.budgetMax
    ) {
      throw new ApiError(400, "INVALID_BUDGET", "Budget minimum tidak boleh melebihi budget maksimum.");
    }

    const fingerprint = `${currentUser.id}:${input.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
    const [created] = await getDb()
      .insert(jobs)
      .values({
        ...input,
        clientId: currentUser.id,
        source: "minebuild",
        fingerprint,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
