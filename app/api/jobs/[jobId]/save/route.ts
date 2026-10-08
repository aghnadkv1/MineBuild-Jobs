import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireUser, ApiError, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { jobs, savedJobs } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const currentUser = await requireUser(request);
    const { jobId: rawJobId } = await params;
    const jobId = requireUuid(rawJobId, "ID lowongan");
    const [job] = await getDb()
      .select({ id: jobs.id })
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "open")))
      .limit(1);
    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");
    await getDb()
      .insert(savedJobs)
      .values({ userId: currentUser.id, jobId })
      .onConflictDoNothing();
    return NextResponse.json({ data: { jobId, saved: true } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const currentUser = await requireUser(request);
    const { jobId: rawJobId } = await params;
    const jobId = requireUuid(rawJobId, "ID lowongan");
    await getDb()
      .delete(savedJobs)
      .where(and(eq(savedJobs.userId, currentUser.id), eq(savedJobs.jobId, jobId)));
    return NextResponse.json({ data: { jobId, saved: false } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
