import { z } from "zod";

const textArray = z.array(z.string().trim().min(1).max(80)).max(40).default([]);
const secureUrl = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "URL harus menggunakan HTTPS.");
const optionalUrl = secureUrl.optional().nullable();

export const profileInput = z.object({
  displayName: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  skills: textArray.optional(),
  styles: textArray.optional(),
  projectTypes: textArray.optional(),
  minecraftVersions: textArray.optional(),
  tools: textArray.optional(),
  experience: z.string().trim().max(100).optional().nullable(),
  availability: z.enum(["available", "busy", "unavailable"]).optional(),
  preferredBudgetMin: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  preferredBudgetMax: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  isPublic: z.boolean().optional(),
}).superRefine((profile, context) => {
  if (
    profile.preferredBudgetMin !== undefined &&
    profile.preferredBudgetMin !== null &&
    profile.preferredBudgetMax !== undefined &&
    profile.preferredBudgetMax !== null &&
    profile.preferredBudgetMin > profile.preferredBudgetMax
  ) {
    context.addIssue({
      code: "custom",
      path: ["preferredBudgetMax"],
      message: "Budget maksimum tidak boleh lebih kecil dari budget minimum.",
    });
  }
});

export const portfolioInput = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(3000).default(""),
  category: z.string().trim().min(2).max(80),
  style: textArray,
  minecraftVersion: z.string().trim().max(40).optional().nullable(),
  projectRole: z.string().trim().max(100).optional().nullable(),
  projectDate: z.string().date().optional().nullable(),
  dimensions: z.string().trim().max(80).optional().nullable(),
  imageUrls: z.array(secureUrl).max(20).default([]),
  sourceUrl: optionalUrl,
  isPublic: z.boolean().default(true),
});

export const jobInput = z.object({
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(30).max(12000),
  projectType: z.string().trim().max(80).optional().nullable(),
  style: textArray,
  minecraftVersion: z.string().trim().max(40).optional().nullable(),
  requiredSkills: textArray,
  budgetMin: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  budgetMax: z.number().int().min(0).max(1_000_000_000).optional().nullable(),
  budgetNegotiable: z.boolean().default(false),
  deadline: z.string().date().optional().nullable(),
  complexity: z.enum(["low", "medium", "high", "expert"]).optional().nullable(),
  estimatedSize: z.string().trim().max(100).optional().nullable(),
  deliverables: textArray,
  referenceUrls: z.array(secureUrl).max(20).default([]),
});

export const proposalInput = z.object({
  jobId: z.string().uuid(),
  content: z.string().trim().min(20).max(10000),
  aiGenerated: z.boolean().default(false),
});

export const conversationInput = z.object({
  jobId: z.string().uuid(),
});

export const messageInput = z.object({
  body: z.string().trim().min(1).max(5000),
  attachmentUrls: z.array(secureUrl).max(10).default([]),
  portfolioProjectId: z.string().uuid().optional().nullable(),
});
