import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, pagination, readJson, requireUser } from "@/lib/api";
import { getDb } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const { searchParams } = new URL(request.url);
    const { limit, offset } = pagination(searchParams);
    const unreadOnly = searchParams.get("unread") === "true";
    const filter = unreadOnly
      ? and(eq(notifications.userId, currentUser.id), isNull(notifications.readAt))
      : eq(notifications.userId, currentUser.id);
    const data = await getDb()
      .select()
      .from(notifications)
      .where(filter)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
    return NextResponse.json({ data, pagination: { limit, offset } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

const markReadInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100).optional(),
  all: z.literal(true).optional(),
});

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireUser(request);
    const input = markReadInput.parse(await readJson(request));
    if (!input.all && !input.ids?.length) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Berikan daftar ids atau all: true." } },
        { status: 400 },
      );
    }
    const where = input.all
      ? and(eq(notifications.userId, currentUser.id), isNull(notifications.readAt))
      : and(
          eq(notifications.userId, currentUser.id),
          inArray(notifications.id, input.ids!),
        );
    const updated = await getDb()
      .update(notifications)
      .set({ readAt: new Date() })
      .where(where)
      .returning({ id: notifications.id });
    return NextResponse.json({ data: { updatedCount: updated.length } });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
