# Acads

Website for Acads coaching (Class 6 to 10). Rahul (admin), teachers, students and parents each sign in with a username and password.

- **Admin:** all students with attendance, homework and test average, and Strong / On track / Needs help per subject. Creates every login and is the only one who can change passwords. Posts notices to everyone, one batch or one student.
- **Teachers:** log each class (topic, notes, homework, attendance), tick homework, enter test marks and write remarks. A teacher only works with the subjects assigned to them.
- **Students:** classes they missed with notes and homework, pending homework, notices, progress per subject and the topics to revise.
- **Parents:** the same view for their child (or children) with teacher remarks.
- **Calendar:** teachers plan classes and tests with prerequisites. Students and parents see the next two weeks, and a planned class opens the log form already filled in.
- **Tasks:** after a class, a teacher gives a task to some or all students. Students tick it off; the teacher sees who is done.
- **Worksheets:** numbered sheets assigned to a whole batch. Add them on the site (admin) or as files in `sheets/` (see `sheets/README.md`), which sync on every deploy.
- **Home page:** the public landing page at `/` with the logo, classes, method, facilities and an admission enquiry form. Enquiries land in **Enquiries** for the admin. Links like `/?class=7#admissions` preselect a class, and `/?src=facebook` records where the visitor came from.
- **Fees (admin only):** fee plans split into installments, payments with numbered receipts (cash, UPI, bank, cheque), concessions, and what is outstanding or overdue. Payments and concessions are never deleted; a mistake is reversed with a reason and stays in the history. Parents see their child's fees and receipts under **Fees**. Students and teachers can't see fees.
- **Behaviour notes:** private notes and advice per student, visible only to the admin.

Built with Next.js and Postgres (hosted on Vercel and Supabase).

## Put it online (one time, about 15 minutes)

1. **Supabase (database).** Sign up at supabase.com and create a project. Open *Connect* and copy the **Transaction pooler** connection string. Replace `[YOUR-PASSWORD]` with the database password you chose.
2. **Vercel (website).** Sign up at vercel.com with GitHub, choose *Add New → Project*, and import `acads`. Under *Environment Variables* add:
   - `DATABASE_URL`: the connection string from step 1
   - `SESSION_SECRET`: any long random text (at least 32 characters)
   - `ADMIN_PASSWORD`: the password for your admin login (username `rahul`)

   Click *Deploy*. Each deploy runs `npm run vercel-build`, which creates the tables, the Class 6–10 batches, the subjects and your admin login before building. It is safe to run again: it never changes data that is already there, and the admin password is only used the first time.
3. Open the link Vercel gives you (like `acads.vercel.app`), sign in as `rahul`, open **Logins** and add your teachers, students and parents.

## Backups

The database is copied every night, encrypted, and kept for 90 days. Setup and restore steps are in [docs/backups.md](docs/backups.md).

## Run it on your computer

```bash
cp .env.example .env.local   # fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:setup
npm run db:demo              # optional sample students; never on the real database
npm run dev
```
