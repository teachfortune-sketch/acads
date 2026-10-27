import postgres from "postgres";

const globalForSql = globalThis as unknown as { sql?: postgres.Sql };

// Supabase's transaction pooler (port 6543) sometimes never passes back the reply to a query's first step, so a page
// waits until it times out while the database waits on the page. Its session pooler (port 5432 on the same host) keeps
// one database connection per client and doesn't do that, so use it instead. prepare: false stays safe either way.
// Connections are short-lived and give up quickly when the database can't be reached.
function databaseUrl() {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") url.port = "5432";
  return url.toString();
}

export const sql =
  globalForSql.sql ?? postgres(databaseUrl(), { prepare: false, max: 3, idle_timeout: 10, max_lifetime: 60 * 5, connect_timeout: 10 });

if (process.env.NODE_ENV !== "production") globalForSql.sql = sql;
