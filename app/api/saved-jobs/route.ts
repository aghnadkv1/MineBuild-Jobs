import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireUser } from "@/lib/api";
import { getDb } from "@/lib/db";
import { jobs, savedJobs, user } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const data = await getDb()
      .select({
        savedAt: savedJobs.createdAt,
        id: jobs.id,
        title: jobs.title,
        description: jobs.description,
        projectType: jobs.projectType,
        style: jobs.style,
        minecraftVersion: jobs.minecraftVersion,
        requiredSkills: jobs.requiredSkills,
        budgetMin: jobs.budgetMin,
        budgetMax: jobs.budgetMax,
        currency: jobs.currency,
        source: jobs.source,
        externalId: jobs.externalId,
        sourceUrl: jobs.sourceUrl,
        discoveredAt: jobs.discoveredAt,
        deadline: jobs.deadline,
        status: jobs.status,
        clientName: user.name,
      })
      .from(savedJobs)
      .innerJoin(jobs, eq(savedJobs.jobId, jobs.id))
      .leftJoin(user, eq(jobs.clientId, user.id))
      .where(
        and(
          eq(savedJobs.userId, currentUser.id),
          inArray(jobs.status, ["open", "closed"]),
        ),
      )
      .orderBy(desc(savedJobs.createdAt));
    return NextResponse.json({ data });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
