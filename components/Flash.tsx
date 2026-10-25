export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  if (sp.err) return <div className="err" role="alert">{sp.err}</div>;
  if (sp.ok) return <div className="ok" role="status">{sp.ok}</div>;
  return null;
}
