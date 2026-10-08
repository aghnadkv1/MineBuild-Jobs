import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { z } from "zod";
import * as schema from "@/lib/db/schema";
import { getDb } from "@/lib/db";
import { ServerConfigurationError } from "@/lib/errors";

let authInstance: ReturnType<typeof createAuth> | undefined;

function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new ServerConfigurationError(
      "BETTER_AUTH_SECRET must be configured with at least 32 characters.",
    );
  }

  return betterAuth({
    appName: "MineBuild Jobs",
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    secret,
    trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: false,
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "builder",
          input: true,
          validator: { input: z.enum(["builder", "client"]) },
        },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
  });
}

export function getAuth() {
  authInstance ??= createAuth();
  return authInstance;
}
