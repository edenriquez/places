import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";

export const alt = "Aviso de privacidad de Entre Lugares";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    icon: "shield",
    eyebrow: "Aviso de privacidad",
    title: "Cómo cuidamos tus datos",
    subtitle: "Qué guardamos, para qué y cómo pedir que lo borremos",
  });
}
