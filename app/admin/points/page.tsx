import { requireRole } from "@/lib/auth";
import { getRules, RULES, RuleKey } from "@/lib/points";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { saveRules } from "../quest-actions";

export default async function PointRulesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const s = await requireRole("admin");
  const sp = await searchParams;
  const rules = await getRules();
  const groups = [...new Set(Object.values(RULES).map((r) => r.group))];
  return (
    <Shell s={s} active="/admin/points">
      <div><h1>Point rules</h1><p className="muted">What each action is worth, the caps, and the attendance cut-offs. Deductions are entered as positive numbers.</p></div>
      <Flash sp={sp} />
      <form action={saveRules} className="stack">
        <div className="grid">
          {groups.map((g) => (
            <fieldset key={g} className="panel form" style={{ gridTemplateColumns: "1fr" }}>
              <legend className="chip c-warn">{g}</legend>
              {(Object.entries(RULES) as [RuleKey, (typeof RULES)[RuleKey]][]).filter(([, r]) => r.group === g).map(([k, r]) => (
                <label key={k}>
                  {r.label}
                  <input id={k} name={k} defaultValue={String(rules[k])} required
                    type={k === "term_start" ? "date" : typeof r.def === "number" ? "number" : "time"}
                    min={typeof r.def === "number" ? 0 : undefined} max={typeof r.def === "number" ? 1000 : undefined} />
                  <span className="muted small">Default {String(r.def)}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </div>
        <div><button className="btn-p" type="submit">Save point rules</button></div>
      </form>
    </Shell>
  );
}
