import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, ApiError, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import {
  builderProfiles,
  conversations,
  jobs,
  messages,
  notifications,
  proposals,
} from "@/lib/db/schema";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ proposalId: string }> },
) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const { proposalId: rawProposalId } = await params;
    const proposalId = requireUuid(rawProposalId, "ID proposal");
    const [profile] = await getDb()
      .select({ id: builderProfiles.id })
      .from(builderProfiles)
      .where(eq(builderProfiles.userId, currentUser.id))
      .limit(1);
    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profil builder belum dibuat.");

    const db = getDb();
    const sent = await db.transaction(async (tx) => {
      const [draft] = await tx
        .select({
          id: proposals.id,
          jobId: proposals.jobId,
          content: proposals.content,
        })
        .from(proposals)
        .where(
          and(
            eq(proposals.id, proposalId),
            eq(proposals.builderId, profile.id),
            eq(proposals.status, "draft"),
          ),
        )
        .for("update")
        .limit(1);
      if (!draft) {
        throw new ApiError(409, "DRAFT_NOT_SENDABLE", "Proposal bukan draft aktif milik akun ini.");
      }

      const [job] = await tx
        .select({
          id: jobs.id,
          clientId: jobs.clientId,
          source: jobs.source,
          status: jobs.status,
        })
        .from(jobs)
        .where(eq(jobs.id, draft.jobId))
        .limit(1);
      if (job && job.source !== "minebuild") {
        throw new ApiError(
          409,
          "EXTERNAL_PROPOSAL_REQUIRES_REVIEW",
          "Lowongan eksternal tidak dapat menerima proposal melalui MineBuild. Tinjau dan kirim secara manual di situs sumber.",
        );
      }
      if (!job?.clientId) {
        throw new ApiError(409, "CLIENT_UNAVAILABLE", "Klien belum memiliki akun untuk menerima proposal.");
      }
      if (job.status !== "open") {
        throw new ApiError(409, "JOB_NOT_OPEN", "Proposal hanya dapat dikirim untuk lowongan aktif.");
      }

      const [conversation] = await tx
        .insert(conversations)
        .values({
          jobId: job.id,
          builderId: currentUser.id,
          clientId: job.clientId,
        })
        .onConflictDoUpdate({
          target: [conversations.jobId, conversations.builderId, conversations.clientId],
          set: { updatedAt: new Date() },
        })
        .returning({ id: conversations.id });

      await tx.insert(messages).values({
        conversationId: conversation.id,
        senderId: currentUser.id,
        body: draft.content,
      });
      await tx
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conversation.id));
      await tx
        .insert(notifications)
        .values({
          userId: job.clientId,
          type: "proposal_received",
          title: "Proposal baru",
          body: `${currentUser.name} mengirimkan proposal untuk lowongan Anda.`,
          resourceType: "conversation",
          resourceId: conversation.id,
          dedupeKey: `proposal-sent:${draft.id}`,
        })
        .onConflictDoNothing();

      const [updated] = await tx
        .update(proposals)
        .set({ status: "sent", approvedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(proposals.id, draft.id),
            eq(proposals.builderId, profile.id),
            eq(proposals.status, "draft"),
          ),
        )
        .returning();
      return updated;
    });

    return NextResponse.json({ data: sent });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
