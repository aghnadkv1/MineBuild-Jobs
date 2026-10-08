import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, ApiError, readJson, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, portfolioProjects } from "@/lib/db/schema";
import { portfolioInput } from "@/lib/schemas";

export const runtime = "nodejs";

async function ownedProject(request: Request, projectId: string) {
  const currentUser = await requireRole(request, ["builder", "admin"]);
  const [project] = await getDb()
    .select({ id: portfolioProjects.id })
    .from(portfolioProjects)
    .innerJoin(builderProfiles, eq(portfolioProjects.builderId, builderProfiles.id))
    .where(
      and(
        eq(portfolioProjects.id, projectId),
        eq(builderProfiles.userId, currentUser.id),
      ),
    )
    .limit(1);
  if (!project) throw new ApiError(404, "PORTFOLIO_NOT_FOUND", "Portfolio tidak ditemukan.");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId: rawProjectId } = await params;
    const projectId = requireUuid(rawProjectId, "ID portfolio");
    await ownedProject(request, projectId);
    const input = portfolioInput.partial().parse(await readJson(request));
    if (Object.keys(input).length === 0) {
      throw new ApiError(400, "EMPTY_UPDATE", "Berikan setidaknya satu kolom untuk diperbarui.");
    }
    const [updated] = await getDb()
      .update(portfolioProjects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(portfolioProjects.id, projectId))
      .returning();
    return NextResponse.json({ data: updated });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId: rawProjectId } = await params;
    const projectId = requireUuid(rawProjectId, "ID portfolio");
    await ownedProject(request, projectId);
    await getDb().delete(portfolioProjects).where(eq(portfolioProjects.id, projectId));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
