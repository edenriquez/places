import { planIcsEvent, type GroupPlan } from "@/lib/group-plans";
import { ics, icsResponse } from "@/lib/ics";
import { createClient } from "@/lib/supabase/server";

/** "Agregar al calendario" de un plan en grupo: el mismo evento para todos los que van, con quién y dónde se ven. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[0-9a-f]{18}$/.test(code)) return new Response("No encontrado", { status: 404 });
  const sb = await createClient();
  const [{ data }, { data: { user } }] = await Promise.all([sb.rpc("plan_by_code", { p_code: code }), sb.auth.getUser()]);
  if (!data) return new Response("No encontrado", { status: 404 });
  const plan = data as GroupPlan;
  return icsResponse(ics([planIcsEvent(plan, user?.id)], plan.target.title), `plan-${plan.target.slug}`, { personal: true });
}
