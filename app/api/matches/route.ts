import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, pagination } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, jobs, matchResults } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const { limit, offset } = pagination(new URL(request.url).searchParams);
    const [profile] = await getDb()
      .select({ id: builderProfiles.id })
      .from(builderProfiles)
      .where(eq(builderProfiles.userId, currentUser.id))
      .limit(1);
    if (!profile) return NextResponse.json({ data: [] });
    const data = await getDb()
      .select({
        jobId: matchResults.jobId,
        score: matchResults.score,
        skillScore: matchResults.skillScore,
        projectTypeScore: matchResults.projectTypeScore,
        styleScore: matchResults.styleScore,
        budgetScore: matchResults.budgetScore,
        complexityScore: matchResults.complexityScore,
        portfolioScore: matchResults.portfolioScore,
        missingRequirements: matchResults.missingRequirements,
        strengths: matchResults.strengths,
        reasons: matchResults.reasons,
        risks: matchResults.risks,
        generatedAt: matchResults.generatedAt,
        jobTitle: jobs.title,
        jobDescription: jobs.description,
        jobStyles: jobs.style,
        budgetMin: jobs.budgetMin,
        budgetMax: jobs.budgetMax,
        deadline: jobs.deadline,
      })
      .from(matchResults)
      .innerJoin(jobs, eq(matchResults.jobId, jobs.id))
      .where(and(eq(matchResults.builderId, profile.id), eq(jobs.status, "open")))
      .orderBy(desc(matchResults.score))
      .limit(limit)
      .offset(offset);
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
