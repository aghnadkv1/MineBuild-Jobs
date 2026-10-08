import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, ApiError, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, jobs, proposals } from "@/lib/db/schema";
import { proposalInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const [profile] = await getDb()
      .select({ id: builderProfiles.id })
      .from(builderProfiles)
      .where(eq(builderProfiles.userId, currentUser.id))
      .limit(1);
    if (!profile) return NextResponse.json({ data: [] });
    const rows = await getDb()
      .select()
      .from(proposals)
      .where(eq(proposals.builderId, profile.id))
      .orderBy(desc(proposals.updatedAt));
    return NextResponse.json({ data: rows });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const input = proposalInput.parse(await readJson(request));
    const db = getDb();
    const [profile] = await db
      .insert(builderProfiles)
      .values({ userId: currentUser.id, displayName: currentUser.name })
      .onConflictDoUpdate({
        target: builderProfiles.userId,
        set: { updatedAt: new Date() },
      })
      .returning({ id: builderProfiles.id });
    const [job] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, input.jobId)).limit(1);
    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");

    const [proposal] = await db
      .insert(proposals)
      .values({
        jobId: input.jobId,
        builderId: profile.id,
        content: input.content,
        aiGenerated: input.aiGenerated,
        status: "draft",
      })
      .returning();

    return NextResponse.json({ data: proposal }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
