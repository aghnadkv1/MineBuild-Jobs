export type NormalizedExternalJob = {
  source: "upwork" | "fiverr";
  externalId: string;
  normalizedUrl: string | null;
  sourceUrl: string | null;
  title: string;
  description: string;
  projectType: string | null;
  requiredSkills: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  pricingType: string | null;
  sourceStatus: string;
  sourceClientInfo: Record<string, unknown> | null;
  projectDuration: string | null;
  experienceLevel: string | null;
  applicantsCount: number | null;
  postedAt: Date;
  fingerprint: string;
};

export interface JobSourceAdapter {
  readonly source: NormalizedExternalJob["source"];
  discover(): Promise<NormalizedExternalJob[]>;
}
