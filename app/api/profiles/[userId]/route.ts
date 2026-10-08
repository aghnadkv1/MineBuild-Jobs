import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, requireUuid } from "@/lib/api";
import { getDb } from "@/lib/db";
import { builderProfiles, portfolioProjects, user } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: rawUserId } = await params;
    const userId = requireUuid(rawUserId, "ID pengguna");
    const [profile] = await getDb()
      .select({
        id: builderProfiles.id,
        userId: builderProfiles.userId,
        displayName: builderProfiles.displayName,
        bio: builderProfiles.bio,
        skills: builderProfiles.skills,
        styles: builderProfiles.styles,
        projectTypes: builderProfiles.projectTypes,
        minecraftVersions: builderProfiles.minecraftVersions,
        tools: builderProfiles.tools,
        experience: builderProfiles.experience,
        availability: builderProfiles.availability,
        createdAt: builderProfiles.createdAt,
        accountName: user.name,
      })
      .from(builderProfiles)
      .innerJoin(user, eq(builderProfiles.userId, user.id))
      .where(and(eq(builderProfiles.userId, userId), eq(builderProfiles.isPublic, true)))
      .limit(1);

    if (!profile) throw new ApiError(404, "PROFILE_NOT_FOUND", "Profil publik tidak ditemukan.");
    const portfolio = await getDb()
      .select({
        id: portfolioProjects.id,
        title: portfolioProjects.title,
        description: portfolioProjects.description,
        category: portfolioProjects.category,
        style: portfolioProjects.style,
        minecraftVersion: portfolioProjects.minecraftVersion,
        projectRole: portfolioProjects.projectRole,
        projectDate: portfolioProjects.projectDate,
        dimensions: portfolioProjects.dimensions,
        imageUrls: portfolioProjects.imageUrls,
        sourceUrl: portfolioProjects.sourceUrl,
      })
      .from(portfolioProjects)
      .where(and(eq(portfolioProjects.builderId, profile.id), eq(portfolioProjects.isPublic, true)));

    return NextResponse.json({ data: profile, portfolio });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
