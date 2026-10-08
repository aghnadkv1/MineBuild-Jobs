import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import type { JobSourceAdapter, NormalizedExternalJob } from "@/lib/integrations/job-source-contract";

export const minecraftJobSearchTerms = [
  "Minecraft Builder",
  "Minecraft Build",
  "Minecraft Spawn",
  "Minecraft Lobby",
  "Minecraft Hub",
  "Minecraft Map",
  "Minecraft World",
  "Minecraft Terrain",
  "Minecraft Architecture",
  "Minecraft Server Build",
  "Minecraft Dungeon",
  "Minecraft Terraforming",
  "Minecraft Interior",
  "Minecraft Exterior",
] as const;

const searchResultSchema = z.object({
  recordNumber: z.string().min(1).max(255),
  title: z.string().trim().min(1).transform((title) => title.slice(0, 160)),
  description: z.string().trim().min(1).transform((description) => description.slice(0, 12_000)),
  ciphertext: z.string().min(1).max(512),
  category: z.string().nullable().optional(),
  subcategory: z.string().nullable().optional(),
  durationLabel: z.string().nullable().optional(),
  engagement: z.string().nullable().optional(),
  amount: z.object({ rawValue: z.string(), currency: z.string() }).nullable().optional(),
  hourlyBudgetMin: z.object({ rawValue: z.string(), currency: z.string() }).nullable().optional(),
  hourlyBudgetMax: z.object({ rawValue: z.string(), currency: z.string() }).nullable().optional(),
  experienceLevel: z.string().nullable().optional(),
  totalApplicants: z.number().int().nonnegative().nullable().optional(),
  publishedDateTime: z.string().nullable().optional(),
  createdDateTime: z.string().nullable().optional(),
  client: z.object({
    totalHires: z.number().int().nonnegative().nullable().optional(),
    totalPostedJobs: z.number().int().nonnegative().nullable().optional(),
    totalSpent: z.object({ rawValue: z.string(), currency: z.string() }).nullable().optional(),
    totalFeedback: z.number().nullable().optional(),
    verificationStatus: z.string().nullable().optional(),
  }).nullable().optional(),
  skills: z.array(z.object({
    name: z.string().nullable().optional(),
    prettyName: z.string().nullable().optional(),
  })).nullable().optional(),
});

const upworkSearchResponseSchema = z.object({
  data: z.object({
    marketplaceJobPostingsSearch: z.object({
      totalCount: z.number().int().nonnegative(),
      edges: z.array(z.object({
        node: searchResultSchema,
      })),
      pageInfo: z.object({
        endCursor: z.string().nullable(),
        hasNextPage: z.boolean(),
      }),
    }),
  }).nullable().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

const upworkSearchQuery = `
  query SearchMinecraftJobs(
    $marketPlaceJobFilter: MarketplaceJobPostingsSearchFilter
    $searchType: MarketplaceJobPostingSearchType
  ) {
    marketplaceJobPostingsSearch(
      marketPlaceJobFilter: $marketPlaceJobFilter
      searchType: $searchType
    ) {
      totalCount
      edges {
        node {
          recordNumber
          title
          description
          ciphertext
          category
          subcategory
          durationLabel
          engagement
          amount { rawValue currency }
          hourlyBudgetMin { rawValue currency }
          hourlyBudgetMax { rawValue currency }
          experienceLevel
          totalApplicants
          publishedDateTime
          createdDateTime
          client {
            totalHires
            totalPostedJobs
            totalSpent { rawValue currency }
            totalFeedback
            verificationStatus
          }
          skills { name prettyName }
        }
      }
      pageInfo { endCursor hasNextPage }
    }
  }
`;

function parseMoney(value: string | undefined) {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1_000_000_000
    ? Math.round(parsed)
    : null;
}

function normalizeExternalUrl(value: string | null) {
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "www.upwork.com") {
    throw new ApiError(502, "INVALID_SOURCE_URL", "Upwork mengembalikan URL lowongan yang tidak valid.");
  }
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString();
}

function isMinecraftOpportunity(title: string, description: string) {
  const content = `${title} ${description}`.toLowerCase();
  if (!content.includes("minecraft")) return false;
  return [
    "builder",
    "build",
    "spawn",
    "lobby",
    "hub",
    "map",
    "world",
    "terrain",
    "architecture",
    "server",
    "dungeon",
    "terraform",
    "interior",
    "exterior",
  ].some((term) => content.includes(term));
}

function parsePostedAt(value: string | null | undefined) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? new Date() : parsed;
}

function normalizeUpworkResult(
  sourceJob: z.infer<typeof searchResultSchema>,
): NormalizedExternalJob | null {
  if (!isMinecraftOpportunity(sourceJob.title, sourceJob.description)) return null;

  const hourlyMin = parseMoney(sourceJob.hourlyBudgetMin?.rawValue);
  const hourlyMax = parseMoney(sourceJob.hourlyBudgetMax?.rawValue);
  const fixedAmount = parseMoney(sourceJob.amount?.rawValue);
  const isHourly = sourceJob.hourlyBudgetMin != null || sourceJob.hourlyBudgetMax != null ||
    sourceJob.engagement?.toLowerCase().includes("hourly") === true;
  const rawCurrency =
    (isHourly
      ? sourceJob.hourlyBudgetMin?.currency ?? sourceJob.hourlyBudgetMax?.currency
      : sourceJob.amount?.currency)?.toUpperCase() ?? "USD";
  const currency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "USD";
  const sourceUrl = normalizeExternalUrl(
    `https://www.upwork.com/jobs/~${encodeURIComponent(sourceJob.ciphertext)}`,
  );
  const projectType = [sourceJob.category, sourceJob.subcategory]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" / ") || null;
  const requiredSkills = [
    ...new Set(
      (sourceJob.skills ?? [])
        .map((skill) => skill.prettyName?.trim() || skill.name?.trim())
        .filter((skill): skill is string => Boolean(skill)),
    ),
  ].slice(0, 40);
  const sourceClientInfo = sourceJob.client
    ? {
        totalHires: sourceJob.client.totalHires ?? null,
        totalPostedJobs: sourceJob.client.totalPostedJobs ?? null,
        totalSpent: sourceJob.client.totalSpent?.rawValue ?? null,
        totalSpentCurrency: sourceJob.client.totalSpent?.currency ?? null,
        feedbackScore: sourceJob.client.totalFeedback ?? null,
        verificationStatus: sourceJob.client.verificationStatus ?? null,
      }
    : null;
  const contentFingerprint = [
    sourceJob.title.toLowerCase().replace(/\s+/g, " ").trim(),
    sourceJob.description.toLowerCase().replace(/\s+/g, " ").trim(),
  ].join("\n");
  const fingerprint = createHash("sha256")
    .update(`upwork\n${contentFingerprint}`)
    .digest("hex");

  return {
    source: "upwork",
    externalId: sourceJob.recordNumber,
    normalizedUrl: sourceUrl,
    sourceUrl,
    title: sourceJob.title,
    description: sourceJob.description,
    projectType,
    requiredSkills,
    budgetMin: isHourly ? hourlyMin : fixedAmount,
    budgetMax: isHourly ? hourlyMax : fixedAmount,
    currency,
    pricingType: isHourly ? "hourly" : fixedAmount === null ? null : "fixed",
    sourceStatus: "open",
    sourceClientInfo,
    projectDuration: sourceJob.durationLabel ?? null,
    experienceLevel: sourceJob.experienceLevel ?? null,
    applicantsCount: sourceJob.totalApplicants ?? null,
    postedAt: parsePostedAt(sourceJob.publishedDateTime ?? sourceJob.createdDateTime),
    fingerprint,
  };
}

export const upworkJobSource: JobSourceAdapter = {
  source: "upwork",
  async discover() {
    const searchExpression = minecraftJobSearchTerms
      .map((term) => `"${term}"`)
      .join(" OR ");
    const allNodes: z.infer<typeof searchResultSchema>[] = [];
    let accessToken = await getUpworkAccessToken();
    let after = "0";
    let hasNextPage = true;
    for (let page = 0; page < 5 && hasNextPage; page += 1) {
      const requestSearch = (token: string) =>
        fetch("https://api.upwork.com/graphql", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            query: upworkSearchQuery,
            variables: {
              marketPlaceJobFilter: {
                searchExpression_eq: searchExpression,
                pagination_eq: { first: 50, after },
              },
              searchType: "USER_JOBS_SEARCH",
            },
          }),
          signal: AbortSignal.timeout(30_000),
        });
      let response = await requestSearch(accessToken);
      if (response.status === 401) {
        accessToken = await getUpworkAccessToken(true);
        response = await requestSearch(accessToken);
      }
      if (!response.ok) {
        if (response.status === 401) {
          throw new ApiError(401, "UPWORK_REAUTH_REQUIRED", "Koneksi Upwork perlu diperbarui. Hubungkan ulang akun Upwork.");
        }
        throw new ApiError(502, "UPWORK_SEARCH_FAILED", `Pencarian lowongan Upwork gagal (HTTP ${response.status}).`);
      }

      const parsedResponse = upworkSearchResponseSchema.safeParse(await response.json());
      if (!parsedResponse.success) {
        throw new ApiError(502, "UPWORK_INVALID_RESPONSE", "Respons pencarian Upwork tidak sesuai dokumentasi.");
      }
      const { data, errors } = parsedResponse.data;
      if (errors?.length) {
        throw new ApiError(502, "UPWORK_SEARCH_FAILED", `Pencarian Upwork gagal: ${errors[0].message.slice(0, 300)}`);
      }
      const search = data?.marketplaceJobPostingsSearch;
      if (!search) {
        throw new ApiError(502, "UPWORK_EMPTY_RESPONSE", "Upwork tidak mengembalikan hasil pencarian.");
      }
      allNodes.push(...search.edges.map(({ node }) => node));
      hasNextPage = search.pageInfo.hasNextPage;
      if (hasNextPage) {
        if (!search.pageInfo.endCursor || search.pageInfo.endCursor === after) {
          throw new ApiError(502, "UPWORK_INVALID_PAGINATION", "Paginasi Upwork tidak mengembalikan cursor lanjutan yang valid.");
        }
        after = search.pageInfo.endCursor;
      }
    }
    return allNodes
      .map((node) => normalizeUpworkResult(node))
      .filter((job): job is NormalizedExternalJob => job !== null);
  },
};

async function getUpworkAccessToken(forceRefresh = false): Promise<string> {
  const { getUpworkAccessToken: getToken } = await import("@/lib/integrations/upwork-oauth");
  return getToken(forceRefresh);
}
