import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL!;

  if (url.includes("neon.tech")) {
    // Production: Neon serverless HTTP driver
    const { neon } = require("@neondatabase/serverless");
    const { drizzle } = require("drizzle-orm/neon-http");
    const sql = neon(url);
    return drizzle(sql, { schema });
  } else {
    // Local: node-postgres driver
    const { Pool } = require("pg");
    const { drizzle } = require("drizzle-orm/node-postgres");
    const pool = new Pool({ connectionString: url });
    return drizzle(pool, { schema });
  }
}

export const db = createDb();
