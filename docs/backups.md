# Database backups

Every night at 02:00 India time, the **Database backup** workflow (`.github/workflows/backup.yml`) copies the whole
database with `pg_dump`, encrypts it with your backup password and keeps it for 90 days on that night's run under
**Actions**. It is free: public repositories get unlimited Actions minutes and artifact storage.

The repository is public, so anyone signed in to GitHub could download the file. That is why it is encrypted: without
`BACKUP_PASSWORD` it is unreadable. Keep that password somewhere safe outside GitHub. If you lose it, the backups
can't be opened.

## Set it up (one time, about 5 minutes)

1. **Copy the database address.** In Supabase, open the **acads** project and click **Connect** at the top. Choose
   **Session pooler** and copy the URI. It looks like
   `postgresql://postgres.abcd:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres`.
   Replace `[YOUR-PASSWORD]` with your database password.
   If you don't remember the password, don't reset it without also updating `DATABASE_URL` in Vercel, or the site
   stops working.
2. **Add it to GitHub.** Open the repository on GitHub, then **Settings → Secrets and variables → Actions → New
   repository secret**. Name: `DATABASE_URL`. Secret: the URI from step 1. Click **Add secret**.
3. **Add a backup password.** Click **New repository secret** again. Name: `BACKUP_PASSWORD`. Secret: a new password of
   at least 16 characters that you write down somewhere safe. Click **Add secret**.
4. **Run it once.** Open **Actions → Database backup → Run workflow → Run workflow**. After about a minute the run
   turns green, and its page shows a file named like `acads-2026-10-30-2140` under **Artifacts**. The log line
   `Dumped 38 tables` says how many tables were saved.

GitHub pauses scheduled workflows in a public repository after 60 days without any commits and emails you first. If
that happens, open **Actions → Database backup** and click **Enable workflow**.

## Restore a backup

1. Open **Actions → Database backup**, click the night you want, and download its file under **Artifacts**. You get a
   `.zip` holding `acads-….dump.gpg`.
2. On a computer with `gpg` and the PostgreSQL 17 client tools:

   ```bash
   unzip acads-2026-10-30-0200.zip
   gpg --decrypt --output acads.dump acads-2026-10-30-0200.dump.gpg   # asks for BACKUP_PASSWORD
   pg_restore --list acads.dump | grep -c "TABLE DATA"                 # check it opened
   ```

3. Restore it.

   - **Into a new, empty database** (a new Supabase project, safest):

     ```bash
     pg_restore --no-owner --no-privileges -d "postgresql://…new database…:5432/postgres" acads.dump
     ```

     It ends with `schema "public" already exists` and `errors ignored on restore: 1`. That one is expected and
     harmless. Then point `DATABASE_URL` in Vercel at the new database and redeploy.

   - **Over the live database** (replaces everything in it with the backup, so anything entered since that night is
     lost):

     ```bash
     pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" acads.dump
     ```

Use the session pooler address (port 5432) for both, not the transaction pooler (port 6543).
