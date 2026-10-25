import postgres from "postgres";

const globalForSql = globalThis as unknown as { sql?: postgres.Sql };

// prepare: false keeps this working through Supabase's connection pooler.
export const sql =
  globalForSql.sql ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;
