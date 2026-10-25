# Acads

Website for Acads coaching (Class 6 to 10). Rahul (admin), teachers, students and parents each sign in with a username and password.

- **Admin:** all students with attendance, homework and test average, and Strong / On track / Needs help per subject. Creates every login and is the only one who can change passwords. Posts notices to everyone, one batch or one student.
- **Teachers:** log each class (topic, notes, homework, attendance), tick homework, enter test marks and write remarks. A teacher only works with the subjects assigned to them.
- **Students:** classes they missed with notes and homework, pending homework, notices, progress per subject and the topics to revise.
- **Parents:** the same view for their child (or children) with teacher remarks.

Built with Next.js and Postgres (hosted on Vercel and Supabase).

## Put it online (one time, about 20 minutes)

1. **Supabase (database).** Sign up at supabase.com and create a project (region: Mumbai). Open *Connect* and copy the **Transaction pooler** connection string. Replace `[YOUR-PASSWORD]` with the database password you chose.
2. **Create the tables and your admin login.** On any computer with Node.js 20+:
   ```bash
   git clone https://github.com/teachfortune-sketch/acads.git && cd acads && npm install
   DATABASE_URL="<connection string>" ADMIN_USERNAME=rahul ADMIN_PASSWORD="<your password>" npm run db:setup
   ```
3. **Vercel (website).** Sign up at vercel.com with GitHub, choose *Add New → Project*, and import `acads`. Under *Environment Variables* add:
   - `DATABASE_URL`: the same connection string
   - `SESSION_SECRET`: any long random text (at least 32 characters)
   
   Click *Deploy*. Vercel gives you a link like `acads.vercel.app`. You can add your own domain later in Vercel settings.
4. Sign in as `rahul`, open **Logins** and add your teachers, students and parents.

## Run it on your computer

```bash
cp .env.example .env.local   # fill in DATABASE_URL and SESSION_SECRET
npm install
npm run db:setup
npm run db:demo              # optional sample students; never on the real database
npm run dev
```
