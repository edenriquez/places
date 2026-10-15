import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";

export const alt = "Guías de Entre Lugares: ferias, fiestas y escapadas cerca de la CDMX";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    icon: "fileText",
    eyebrow: "Guías",
    title: "Ferias, fiestas y escapadas cerca de la CDMX",
    subtitle: "Qué ver, qué días ir y a cuánto queda cada pueblo",
  });
}
