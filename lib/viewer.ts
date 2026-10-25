import { Session } from "./auth";
import { sql } from "./db";
import { getBatches, getStudent } from "./queries";

// Which class a page shows: students see their own, parents their child's, staff pick with ?batch=.
export async function viewedBatch(s: Session, sp: Record<string, string>) {
  const batches = await getBatches();
  let batchId: number | null = null, me: number | undefined, child: number | undefined;
  if (s.role === "student") {
    batchId = (await getStudent(s.uid))?.batch_id ?? null;
    me = s.uid;
  } else if (s.role === "parent") {
    const kids = await sql`select st.user_id as id, st.batch_id from students st where st.parent_id = ${s.uid} order by st.user_id`;
    const k = kids.find((x) => x.id === Number(sp.child)) ?? kids[0];
    batchId = k?.batch_id ?? null;
    me = child = k?.id;
  } else {
    batchId = batches.find((b) => b.id === Number(sp.batch))?.id ?? batches[0]?.id ?? null;
  }
  return { batches, batch: batches.find((b) => b.id === batchId) ?? null, me, child, staff: !["student", "parent"].includes(s.role) };
}
