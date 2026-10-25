import Link from "next/link";
import { Batch } from "@/lib/queries";

export function BatchChips({ batches, current, base, all }: { batches: Batch[]; current: number | null; base: string; all?: boolean }) {
  const join = base.includes("?") ? "&" : "?";
  return (
    <div className="chips" aria-label="Batch">
      {all && <Link href={base} aria-current={current == null}>All batches</Link>}
      {batches.map((b) => (
        <Link key={b.id} href={`${base}${join}batch=${b.id}`} aria-current={current === b.id}>
          {b.name}
        </Link>
      ))}
    </div>
  );
}
