import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, ApiError, readJson, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, proposals } from "@/lib/db/schema";
import { z } from "zod";

export const runtime = "nodejs";

const editInput = z.object({
  content: z.string().trim().min(20).max(10000),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const { proposalId: rawProposalId } = await params;
    const proposalId = requireUuid(rawProposalId, "ID proposal");
    const input = editInput.parse(await readJson(request));
    const [profile] = await getDb()
      .select({ id: builderProfiles.id })
      .from(builderProfiles)
      .where(eq(builderProfiles.userId, currentUser.id))
      .limit(1);
    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profil builder belum dibuat.");

    const [updated] = await getDb()
      .update(proposals)
      .set({
        content: input.content,
        version: sql`${proposals.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(proposals.id, proposalId),
          eq(proposals.builderId, profile.id),
          eq(proposals.status, "draft"),
        ),
      )
      .returning();
    if (!updated) {
      throw new ApiError(404, "DRAFT_NOT_FOUND", "Draft proposal tidak ditemukan atau tidak dapat diedit.");
    }
    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
