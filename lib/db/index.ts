import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { ServerConfigurationError } from "@/lib/errors";

type Database = PostgresJsDatabase<typeof schema>;

let database: Database | undefined;

export function getDb(): Database {
  if (database) return database;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new ServerConfigurationError("DATABASE_URL is required to connect to PostgreSQL.");
  }

  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  database = drizzle(client, { schema });
  return database;
}

export type { Database };
