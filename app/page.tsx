import type { Metadata } from "next";
import Link from "next/link";
import { readSession } from "@/lib/auth";
import { ENQUIRY_LEVELS } from "@/lib/enquiry";
import { createEnquiry } from "./enquiry-actions";
import "./landing.css";

export const metadata: Metadata = {
  title: "Acads Coaching Institute, Saket Nagar, Varanasi | Classes 6 to 10",
  description:
    "Coaching for Classes 6 to 10 in Maths, Science, Social Science, English and Hindi, plus CHS and KVS entrance preparation, in Saket Nagar, Varanasi. Discover. Learn. Excel.",
};

const NAV = [
  ["#about", "About"], ["#classes", "Classes"], ["#method", "Method"], ["#facilities", "Facilities"],
  ["#progress", "Progress"], ["#admissions", "Admissions"], ["#contact", "Contact"],
] as const;

const CLASSES = [
  { n: 6, text: "Strong basics in numbers, fractions and science ideas, with English and Hindi alongside." },
  { n: 7, text: "Integers, equations and practical science, with regular practice sheets to build speed." },
  { n: 8, text: "The bridge to higher classes: algebra, geometry and concept-first science." },
  { n: 9, text: "The full syllabus with regular tests and chapter-wise revision." },
  { n: 10, text: "Board year focus: complete syllabus, test practice and steady revision until the exam." },
];

const ENTRANCE = [
  { key: "chs", name: "CHS", full: "Central Hindu School (BHU) entrance",
    text: "Preparation for the CHS entrance test: Maths, reasoning, English, Hindi and general knowledge, with timed mock papers and past-paper practice." },
  { key: "kvs", name: "KVS", full: "Kendriya Vidyalaya admission test",
    text: "Preparation for the KVS admission test: Maths, English, Hindi and the core subjects, with regular practice tests and doubt sessions." },
];

const STEPS = [
  ["Plan", "Every class and test is planned on a calendar. Students see what is coming up and what to revise beforehand."],
  ["Teach", "After each class the teacher records the topic, notes and homework. Absent students can read what they missed the same day."],
  ["Practise", "Homework and numbered worksheets for each batch. Teachers check them and record who has finished."],
  ["Test", "Regular tests with marks entered topic by topic. Absent is recorded as absent, never as zero."],
  ["Follow up", "Any topic under 60% goes on the student's revise list, with a task from the teacher and a note for parents."],
] as const;

const SUBJECTS = [
  ["Maths", "Taught by Rahul"], ["Science", "Taught by Rahul"], ["Social Science", "Taught by Rahul"],
  ["English", "Dedicated English teacher"], ["Hindi", "Dedicated Hindi teacher"],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const session = await readSession();
  const login = session ? { href: "/app", label: "My dashboard" } : { href: "/login", label: "Student login" };
  const pickedClass = ENQUIRY_LEVELS.some(([v]) => v === sp.class) ? sp.class : "";
  const campaign = (sp.src ?? "").replace(/[^a-z0-9-]/gi, "").slice(0, 40);
  const source = campaign || (pickedClass ? `class-${pickedClass}` : "website");
  const srcParam = campaign ? `&src=${campaign}` : "";

  return (
    <div className="lp">
      <header className="lp-top">
        <div className="lp-in">
          <a href="#top" className="lp-brand" aria-label="Acads Coaching Institute, home">
            <img src="/acads-mark.svg" alt="" width={42} height={42} />
            <span><b>Acads</b><small>COACHING INSTITUTE</small></span>
          </a>
          <nav className="lp-nav" aria-label="Sections">
            {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <Link href={login.href} className="lp-btn lp-login">{login.label}</Link>
          <details className="lp-menu">
            <summary>Menu</summary>
            <nav aria-label="Sections">
              {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
              <Link href={login.href}>{login.label}</Link>
            </nav>
          </details>
        </div>
      </header>

      <main id="top">
        <section className="lp-hero">
          <div className="lp-in">
            <div className="lp-hero-copy">
              <span className="lp-eyebrow">Classes 6 to 10 · Saket Nagar, Varanasi</span>
              <h1><span>Discover.</span><span>Learn.</span><span className="hl">Excel.</span></h1>
              <div className="lp-cta">
                <a href="#admissions" className="lp-btn sun">Book a demo class</a>
                <Link href={login.href} className="lp-btn alt">{session ? "Go to my dashboard" : "Student and parent login"}</Link>
              </div>
              <div className="lp-facts">
                <span>Maths</span><span>Science</span><span>Social Science</span><span>English</span><span>Hindi</span>
              </div>
            </div>
            <div className="lp-hero-logo">
              <div className="tile" role="img" aria-label="Acads Coaching Institute: Discover. Learn. Excel.">
                <img src="/acads-mark.svg" alt="" width={220} height={220} />
                <b>Acads</b>
                <small>COACHING INSTITUTE</small>
                <span>Discover. Learn. Excel.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-sec" id="about">
          <div className="lp-in lp-two">
            <div className="lp-head">
              <span className="lp-eyebrow">About Acads</span>
              <h2>Personal attention, with a record to prove it</h2>
              <p className="lp-lead">
                Acads is run by Rahul Yadav for students in Classes 6 to 10 in Saket Nagar. Rahul teaches Maths, Science and Social Science himself, and dedicated teachers take English and Hindi.
              </p>
              <p className="lp-lead">
                What makes Acads different is follow-up. Each student has their own profile that grows with every class, homework and
                test, so nobody falls behind quietly.
              </p>
            </div>
            <div className="lp-subjects" aria-label="Subjects">
              {SUBJECTS.map(([sub, who]) => <div key={sub}><b>{sub}</b><span>{who}</span></div>)}
            </div>
          </div>
        </section>

        <section className="lp-sec wash" id="classes">
          <div className="lp-in">
            <div className="lp-head">
              <span className="lp-eyebrow">Classes</span>
              <h2>Five classes, one way of teaching</h2>
              <p className="lp-lead">All five subjects for every class, plus entrance exam preparation. Choose your child&apos;s class to ask about batches and timings.</p>
            </div>
            <div className="lp-classes">
              {CLASSES.map((c) => (
                <div className="lp-class" key={c.n}>
                  <div className="num">{c.n}<small>Class</small></div>
                  <p>{c.text}</p>
                  <a href={`/?class=${c.n}${srcParam}#admissions`}>Enquire for Class {c.n} →</a>
                </div>
              ))}
            </div>
            <h3 className="lp-subhead">Entrance exam preparation</h3>
            <div className="lp-entrance">
              {ENTRANCE.map((e) => (
                <div className="lp-class" key={e.key}>
                  <div className="num">{e.name}<small>{e.full}</small></div>
                  <p>{e.text}</p>
                  <a href={`/?class=${e.key}${srcParam}#admissions`}>Enquire for {e.name} preparation →</a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-sec sun" id="method">
          <div className="lp-in">
            <div className="lp-head">
              <span className="lp-eyebrow">Our method</span>
              <h2>How every class works at Acads</h2>
              <p className="lp-lead">The same five steps for every batch and every subject, so students and parents always know where they stand.</p>
            </div>
            <ol className="lp-steps">
              {STEPS.map(([t, d]) => <li key={t}><h3>{t}</h3><p>{d}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="lp-sec" id="facilities">
          <div className="lp-in">
            <div className="lp-head">
              <span className="lp-eyebrow">Facilities</span>
              <h2>Built for focused study</h2>
            </div>
            <div className="lp-fac">
              <div><i></i><h3>Interactive classes</h3><p>Students ask questions, discuss ideas and solve problems together in class.</p></div>
              <div><i></i><h3>Numbered worksheets</h3><p>Numbered practice sheets for each chapter, given to the whole batch and checked by the teacher.</p></div>
              <div><i></i><h3>Student and parent portal</h3><p>Every student and parent gets their own login to see classes, homework, marks and notices.</p></div>
              <div><i></i><h3>Missed-class notes</h3><p>If a student is absent, the class notes and homework are waiting for them online the same day.</p></div>
            </div>
          </div>
        </section>

        <section className="lp-sec wash" id="progress">
          <div className="lp-in lp-two">
            <div className="lp-head">
              <span className="lp-eyebrow">Student progress</span>
              <h2>See your progress, not your marks</h2>
              <p className="lp-lead">Each subject is marked from the student&apos;s own test scores, and the weak topics turn into a clear revision list.</p>
              <ul className="lp-list">
                <li><b>Strong</b> means 80% or more in tests.</li>
                <li><b>On track</b> means 60 to 79%.</li>
                <li><b>Needs help</b> means under 60%. Those topics get extra practice and a retest.</li>
                <li>Attendance and homework are tracked for every class, and teachers add remarks for parents.</li>
              </ul>
            </div>
            <div className="lp-card" aria-label="Example progress card">
              <span className="tag">Example only</span>
              <h3>Progress card</h3>
              {([["Maths", 86, "Strong", "p-good"], ["Science", 72, "On track", "p-ok"], ["Social", 54, "Needs help", "p-help"], ["English", 81, "Strong", "p-good"]] as const).map(([s, v, l, c]) => (
                <div className="lp-row" key={s}>
                  <span>{s}</span>
                  <div className="lp-bar"><span style={{ width: `${v}%`, background: c === "p-good" ? "var(--mint)" : c === "p-ok" ? "var(--sky)" : "var(--coral)" }} /></div>
                  <span className={`lp-pill ${c}`}>{l}</span>
                </div>
              ))}
              <div className="lp-revise"><b>Revise next:</b> Social Science, Resources and Development</div>
            </div>
          </div>
        </section>

        <section className="lp-sec pink" id="admissions">
          <div className="lp-in lp-two">
            <div className="lp-head">
              <span className="lp-eyebrow">Admissions open</span>
              <h2>Book a demo class</h2>
              <p className="lp-lead">Send your details and we will call you within one working day to arrange a demo class for your child.</p>
              <div className="lp-path" aria-label="How admission works">
                <span>Enquire</span><span>We call you</span><span>Demo class</span><span>Admission</span>
              </div>
              <p className="lp-lead">After admission, your child gets a student login and you get a parent login.</p>
            </div>
            <form action={createEnquiry} className="lp-form">
              {sp.ok && <div className="lp-msg ok" role="status">{sp.ok}</div>}
              {sp.err && <div className="lp-msg err" role="alert">{sp.err}</div>}
              <input type="hidden" name="source" value={source} />
              <label className="lp-hp" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
              <label>Parent&apos;s name<input id="guardian_name" name="guardian_name" required autoComplete="name" /></label>
              <label>Mobile number<input id="phone" name="phone" type="tel" inputMode="numeric" required autoComplete="tel" placeholder="10-digit number" /></label>
              <label>Student&apos;s name<input id="student_name" name="student_name" /></label>
              <label>Class
                <select id="class_level" name="class_level" defaultValue={pickedClass}>
                  <option value="">Choose…</option>
                  {ENQUIRY_LEVELS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                </select>
              </label>
              <label className="full">Anything we should know? (optional)<textarea id="message" name="message" placeholder="Subjects your child needs help with, preferred timings" /></label>
              <div className="full"><button className="lp-btn sun" type="submit">Request a call back</button></div>
            </form>
          </div>
        </section>

        <section className="lp-sec sky" id="contact">
          <div className="lp-in">
            <div className="lp-head">
              <span className="lp-eyebrow">Contact</span>
              <h2>Visit us in Saket Nagar</h2>
            </div>
            <div className="lp-contact">
              <div><h3>Address</h3><span>Acads Coaching Institute, Saket Nagar, Varanasi, Uttar Pradesh</span>
                <a href="https://www.google.com/maps/search/?api=1&query=Acads+Coaching+Institute+Saket+Nagar+Varanasi" target="_blank" rel="noopener noreferrer">Open in Google Maps</a></div>
              <div><h3>Classes</h3><span>Classes 6, 7, 8, 9 and 10</span><span>CHS and KVS entrance preparation</span><span>Maths, Science, Social Science, English, Hindi</span></div>
              <div><h3>Admissions</h3><span>Use the form above and we will call you back.</span><a href="#admissions">Book a demo class</a></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-foot">
        <div className="lp-in">
          <span>© {new Date().getFullYear()} Acads Coaching Institute · Discover. Learn. Excel.</span>
          <Link href={login.href}>{login.label}</Link>
        </div>
      </footer>
    </div>
  );
}
