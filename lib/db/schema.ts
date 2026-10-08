import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("builder"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const builderProfiles = pgTable(
  "builder_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    skills: text("skills").array().notNull().default([]),
    styles: text("styles").array().notNull().default([]),
    projectTypes: text("project_types").array().notNull().default([]),
    minecraftVersions: text("minecraft_versions").array().notNull().default([]),
    tools: text("tools").array().notNull().default([]),
    experience: text("experience"),
    availability: text("availability").notNull().default("available"),
    preferredBudgetMin: integer("preferred_budget_min"),
    preferredBudgetMax: integer("preferred_budget_max"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("builder_profile_public_idx").on(table.isPublic)],
);

export const portfolioProjects = pgTable(
  "portfolio_project",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    builderId: uuid("builder_id").notNull().references(() => builderProfiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull(),
    style: text("style").array().notNull().default([]),
    minecraftVersion: text("minecraft_version"),
    projectRole: text("project_role"),
    projectDate: date("project_date"),
    dimensions: text("dimensions"),
    imageUrls: text("image_urls").array().notNull().default([]),
    sourceUrl: text("source_url"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("portfolio_builder_id_idx").on(table.builderId)],
);

export const jobs = pgTable(
  "job",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientId: text("client_id").references(() => user.id, { onDelete: "set null" }),
    source: text("source").notNull().default("minebuild"),
    externalId: text("external_id"),
    normalizedUrl: text("normalized_url"),
    currency: text("currency").notNull().default("IDR"),
    pricingType: text("pricing_type"),
    sourceStatus: text("source_status"),
    sourceClientInfo: jsonb("source_client_info").$type<Record<string, unknown>>(),
    projectDuration: text("project_duration"),
    experienceLevel: text("experience_level"),
    applicantsCount: integer("applicants_count"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    projectType: text("project_type"),
    style: text("style").array().notNull().default([]),
    minecraftVersion: text("minecraft_version"),
    requiredSkills: text("required_skills").array().notNull().default([]),
    budgetMin: integer("budget_min"),
    budgetMax: integer("budget_max"),
    budgetNegotiable: boolean("budget_negotiable").notNull().default(false),
    deadline: date("deadline"),
    complexity: text("complexity"),
    estimatedSize: text("estimated_size"),
    deliverables: text("deliverables").array().notNull().default([]),
    referenceUrls: text("reference_urls").array().notNull().default([]),
    sourceUrl: text("source_url"),
    status: text("status").notNull().default("open"),
    discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
    fingerprint: text("fingerprint").notNull().unique(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("job_status_posted_idx").on(table.status, table.postedAt),
    index("job_client_id_idx").on(table.clientId),
    index("job_type_idx").on(table.projectType),
    index("job_budget_idx").on(table.budgetMin, table.budgetMax),
    uniqueIndex("job_source_external_id_unique")
      .on(table.source, table.externalId)
      .where(sql`${table.externalId} is not null`),
    uniqueIndex("job_source_normalized_url_unique")
      .on(table.source, table.normalizedUrl)
      .where(sql`${table.normalizedUrl} is not null`),
  ],
);

export const externalIntegrationTokens = pgTable("external_integration_token", {
  provider: text("provider").primaryKey(),
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: updatedAt(),
});

export const savedJobs = pgTable(
  "saved_job",
  {
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.jobId] }),
    index("saved_job_job_id_idx").on(table.jobId),
  ],
);

export const matchResults = pgTable(
  "match_result",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    builderId: uuid("builder_id").notNull().references(() => builderProfiles.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    skillScore: integer("skill_score").notNull().default(0),
    projectTypeScore: integer("project_type_score").notNull().default(0),
    styleScore: integer("style_score").notNull().default(0),
    budgetScore: integer("budget_score").notNull().default(0),
    complexityScore: integer("complexity_score").notNull().default(0),
    portfolioScore: integer("portfolio_score").notNull().default(0),
    missingRequirements: text("missing_requirements").array().notNull().default([]),
    strengths: text("strengths").array().notNull().default([]),
    reasons: text("reasons").array().notNull().default([]),
    risks: text("risks").array().notNull().default([]),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("match_job_builder_unique").on(table.jobId, table.builderId),
    index("match_builder_score_idx").on(table.builderId, table.score),
  ],
);

export const proposals = pgTable(
  "proposal",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    builderId: uuid("builder_id").notNull().references(() => builderProfiles.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    status: text("status").notNull().default("draft"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    version: integer("version").notNull().default(1),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("proposal_builder_created_idx").on(table.builderId, table.createdAt),
    index("proposal_job_id_idx").on(table.jobId),
  ],
);

export const conversations = pgTable(
  "conversation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    builderId: text("builder_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("conversation_job_parties_unique").on(table.jobId, table.builderId, table.clientId),
    index("conversation_builder_idx").on(table.builderId, table.updatedAt),
    index("conversation_client_idx").on(table.clientId, table.updatedAt),
  ],
);

export const messages = pgTable(
  "message",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: text("sender_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    attachmentUrls: text("attachment_urls").array().notNull().default([]),
    portfolioProjectId: uuid("portfolio_project_id").references(() => portfolioProjects.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (table) => [index("message_conversation_created_idx").on(table.conversationId, table.createdAt)],
);

export const notifications = pgTable(
  "notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    dedupeKey: text("dedupe_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("notification_user_dedupe_unique").on(table.userId, table.dedupeKey),
    index("notification_user_created_idx").on(table.userId, table.createdAt),
  ],
);
