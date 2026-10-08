import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, requireRole, readJson } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, portfolioProjects } from "@/lib/db/schema";
import { portfolioInput, profileInput } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const [profile] = await getDb()
      .select()
      .from(builderProfiles)
      .where(eq(builderProfiles.userId, currentUser.id))
      .limit(1);

    if (!profile) return NextResponse.json({ data: null, portfolio: [] });
    const portfolio = await getDb()
      .select()
      .from(portfolioProjects)
      .where(eq(portfolioProjects.builderId, profile.id))
      .orderBy(portfolioProjects.createdAt);
    return NextResponse.json({ data: profile, portfolio });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const input = profileInput.parse(await readJson(request));
    const displayName = input.displayName ?? currentUser.name;
    const [profile] = await getDb()
      .insert(builderProfiles)
      .values({
        userId: currentUser.id,
        displayName,
        bio: input.bio ?? "",
        skills: input.skills ?? [],
        styles: input.styles ?? [],
        projectTypes: input.projectTypes ?? [],
        minecraftVersions: input.minecraftVersions ?? [],
        tools: input.tools ?? [],
        experience: input.experience,
        availability: input.availability,
        preferredBudgetMin: input.preferredBudgetMin,
        preferredBudgetMax: input.preferredBudgetMax,
        isPublic: input.isPublic,
      })
      .onConflictDoUpdate({
        target: builderProfiles.userId,
        set: { ...input, displayName, updatedAt: new Date() },
      })
      .returning();

    return NextResponse.json({ data: profile });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole(request, ["builder", "admin"]);
    const input = portfolioInput.parse(await readJson(request));
    const db = getDb();
    const [profile] = await db
      .insert(builderProfiles)
      .values({ userId: currentUser.id, displayName: currentUser.name })
      .onConflictDoUpdate({
        target: builderProfiles.userId,
        set: { updatedAt: new Date() },
      })
      .returning({ id: builderProfiles.id });
    const [project] = await db
      .insert(portfolioProjects)
      .values({ ...input, builderId: profile.id })
      .returning();

    return NextResponse.json({ data: project }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
