import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, requireUser, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { jobs, user } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId: rawJobId } = await params;
    const jobId = requireUuid(rawJobId, "ID lowongan");
    const [job] = await getDb()
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
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");
    if (job.status !== "open" && job.status !== "closed") {
      const currentUser = await requireUser(_request);
      if (currentUser.role !== "admin" && currentUser.id !== job.clientId) {
        throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");
      }
    }
    return NextResponse.json({ data: job });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
