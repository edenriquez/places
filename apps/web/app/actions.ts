"use server";

import { cookies } from "next/headers";
import { LOC_COOKIE, serializeLoc, type Loc } from "@/lib/location";
import { createAnonClient } from "@/lib/supabase/server";

function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180;
  const h = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLng - aLng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export async function setLocation(loc: Loc) {
  // con GPS, nombrar la ubicación por el pueblo más cercano ("a 1 h de Tlalmanalco" en vez de "de Tu ubicación")
  if (loc.gps) {
    const { data } = await createAnonClient().from("municipalities_view").select("name,lat,lng");
    const near = (data ?? [])
      .map((m) => ({ name: m.name as string, d: km(loc.lat, loc.lng, m.lat, m.lng) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= 15) loc = { ...loc, label: near.name };
  }
  const c = await cookies();
  c.set(LOC_COOKIE, serializeLoc(loc), { path: "/", maxAge: 60 * 60 * 24 * 180, sameSite: "lax" });
}
