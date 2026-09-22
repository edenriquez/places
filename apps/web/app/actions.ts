"use server";

import { cookies } from "next/headers";
import { LOC_COOKIE, serializeLoc, type Loc } from "@/lib/location";

export async function setLocation(loc: Loc) {
  const c = await cookies();
  c.set(LOC_COOKIE, serializeLoc(loc), { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
}
