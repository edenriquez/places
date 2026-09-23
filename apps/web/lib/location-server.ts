import { cookies } from "next/headers";
import { LOC_COOKIE, parseLoc, type Loc } from "./location";

export async function getLoc(): Promise<Loc> {
  const c = await cookies();
  return parseLoc(c.get(LOC_COOKIE)?.value);
}

/** false en la primera visita: todavía no sabemos dónde está la persona. */
export async function hasLoc(): Promise<boolean> {
  const c = await cookies();
  return !!c.get(LOC_COOKIE)?.value;
}
