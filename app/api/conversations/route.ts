import { desc, eq, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, pagination, requireUser, requireRole, ApiError, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { conversations, jobs, messages } from "@/lib/db/schema";
import { conversationInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const { limit, offset } = pagination(new URL(request.url).searchParams);
    const rows = await getDb()
      .select({
        id: conversations.id,
        jobId: conversations.jobId,
        builderId: conversations.builderId,
        clientId: conversations.clientId,
        status: conversations.status,
        updatedAt: conversations.updatedAt,
        jobTitle: jobs.title,
        otherPartyName: sql<string>`case
          when ${conversations.builderId} = ${currentUser.id} then client_user.name
          else builder_user.name
        end`,
      })
      .from(conversations)
      .leftJoin(jobs, eq(conversations.jobId, jobs.id))
      .leftJoin(sql`"user" as builder_user`, sql`builder_user.id = ${conversations.builderId}`)
      .leftJoin(sql`"user" as client_user`, sql`client_user.id = ${conversations.clientId}`)
      .where(or(eq(conversations.builderId, currentUser.id), eq(conversations.clientId, currentUser.id)))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset);

    const data = await Promise.all(
      rows.map(async (row) => {
        const [lastMessage] = await getDb()
          .select({ body: messages.body, createdAt: messages.createdAt, senderId: messages.senderId })
          .from(messages)
          .where(eq(messages.conversationId, row.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        return {
          ...row,
          lastMessage: lastMessage ?? null,
        };
      }),
    );
    return NextResponse.json({ data, pagination: { limit, offset } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const input = conversationInput.parse(await readJson(request));
    const db = getDb();
    const [job] = await db
      .select({ id: jobs.id, clientId: jobs.clientId, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, input.jobId))
      .limit(1);
    if (!job) throw new ApiError(404, "JOB_NOT_FOUND", "Lowongan tidak ditemukan.");
    if (job.status !== "open") {
      throw new ApiError(409, "JOB_NOT_OPEN", "Percakapan baru hanya dapat dimulai untuk lowongan aktif.");
    }
    if (!job.clientId) {
      throw new ApiError(409, "CLIENT_UNAVAILABLE", "Klien lowongan ini belum memiliki akun untuk chat.");
    }
    if (job.clientId === currentUser.id) {
      throw new ApiError(400, "SELF_CONVERSATION", "Anda tidak dapat memulai percakapan dengan akun sendiri.");
    }

    const [conversation] = await db
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
      .returning();
    return NextResponse.json({ data: conversation }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
