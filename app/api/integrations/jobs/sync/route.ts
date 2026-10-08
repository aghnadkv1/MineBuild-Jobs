import { NextResponse } from "next/server";
import { apiErrorResponse, ApiError, requireRole } from "@/lib/api";
import { getDb } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { fiverrJobSource } from "@/lib/integrations/fiverr";
import type { JobSourceAdapter } from "@/lib/integrations/job-source-contract";
import { upworkJobSource } from "@/lib/integrations/job-sources";

export const runtime = "nodejs";

const adapters: Record<string, JobSourceAdapter> = {
  upwork: upworkJobSource,
  fiverr: fiverrJobSource,
};

export async function POST(request: Request) {
  try {
    await requireRole(request, ["admin"]);
    const source = new URL(request.url).searchParams.get("source") ?? "upwork";
    const adapter = adapters[source];
    if (!adapter) {
      throw new ApiError(400, "INVALID_JOB_SOURCE", "Sumber lowongan yang diminta tidak didukung.");
    }

    const discoveredJobs = await adapter.discover();
    let inserted = 0;
    for (const discovered of discoveredJobs) {
      const [created] = await getDb()
        .insert(jobs)
        .values({
          clientId: null,
          source: discovered.source,
          externalId: discovered.externalId,
          normalizedUrl: discovered.normalizedUrl,
          sourceUrl: discovered.sourceUrl,
          sourceClientInfo: discovered.sourceClientInfo,
          sourceStatus: discovered.sourceStatus,
          currency: discovered.currency,
          pricingType: discovered.pricingType,
          projectDuration: discovered.projectDuration,
          experienceLevel: discovered.experienceLevel,
          applicantsCount: discovered.applicantsCount,
          title: discovered.title,
          description: discovered.description,
          projectType: discovered.projectType,
          requiredSkills: discovered.requiredSkills,
          budgetMin: discovered.budgetMin,
          budgetMax: discovered.budgetMax,
          budgetNegotiable: false,
          deadline: null,
          complexity: null,
          estimatedSize: discovered.projectDuration,
          deliverables: [],
          referenceUrls: [],
          status: "open",
          postedAt: discovered.postedAt,
          discoveredAt: new Date(),
          fingerprint: discovered.fingerprint,
        })
        .onConflictDoNothing()
        .returning({ id: jobs.id });
      if (created) inserted += 1;
    }

    return NextResponse.json({
      data: {
        source: adapter.source,
        discovered: discoveredJobs.length,
        imported: inserted,
        duplicates: discoveredJobs.length - inserted,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
