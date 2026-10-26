import postgres from "postgres";

const globalForSql = globalThis as unknown as { sql?: postgres.Sql };

// prepare: false keeps this working through Supabase's connection pooler. Connections are short-lived and give up
// quickly when the database can't be reached, so a stalled request never keeps a pooler slot for long.
export const sql =
  globalForSql.sql ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 5, idle_timeout: 20, max_lifetime: 60 * 5, connect_timeout: 10 });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;
