import { and, asc, eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireUser, ApiError, pagination, readJson, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { conversations, messages, portfolioProjects } from "@/lib/db/schema";
import { messageInput } from "@/lib/schemas";

export const runtime = "nodejs";

async function requireParticipant(conversationId: string, userId: string) {
  const [conversation] = await getDb()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        or(eq(conversations.builderId, userId), eq(conversations.clientId, userId)),
      ),
    )
    .limit(1);
  if (!conversation) {
    throw new ApiError(404, "CONVERSATION_NOT_FOUND", "Percakapan tidak ditemukan.");
  }
  return conversation;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const currentUser = await requireUser(request);
    const { conversationId: rawConversationId } = await params;
    const conversationId = requireUuid(rawConversationId, "ID percakapan");
    await requireParticipant(conversationId, currentUser.id);
    const { limit, offset } = pagination(new URL(request.url).searchParams);
    const data = await getDb()
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(limit)
      .offset(offset);
    return NextResponse.json({ data, pagination: { limit, offset } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  try {
    const currentUser = await requireUser(request);
    const { conversationId: rawConversationId } = await params;
    const conversationId = requireUuid(rawConversationId, "ID percakapan");
    await requireParticipant(conversationId, currentUser.id);
    const input = messageInput.parse(await readJson(request));
    if (input.portfolioProjectId) {
      const [project] = await getDb()
        .select({ id: portfolioProjects.id })
        .from(portfolioProjects)
        .innerJoin(
          conversations,
          eq(conversations.id, conversationId),
        )
        .where(
          and(
            eq(portfolioProjects.id, input.portfolioProjectId),
            eq(portfolioProjects.isPublic, true),
            or(
              eq(conversations.builderId, currentUser.id),
              eq(conversations.clientId, currentUser.id),
            ),
          ),
        )
        .limit(1);
      if (!project) {
        throw new ApiError(404, "PORTFOLIO_NOT_FOUND", "Portfolio tidak tersedia untuk dibagikan.");
      }
    }

    const [created] = await getDb()
      .insert(messages)
      .values({
        conversationId,
        senderId: currentUser.id,
        body: input.body,
        attachmentUrls: input.attachmentUrls,
        portfolioProjectId: input.portfolioProjectId,
      })
      .returning();
    await getDb()
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
