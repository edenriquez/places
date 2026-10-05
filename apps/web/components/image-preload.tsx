"use client";

import { preload, type PreloadOptions } from "react-dom";

/** preload() desde un server component solo viaja en el payload RSC; aquí el SSR lo pone como <link> en el HTML. */
export function ImagePreload({ href, ...options }: { href: string } & Omit<PreloadOptions, "as">) {
  preload(href, { as: "image", ...options });
  return null;
}
