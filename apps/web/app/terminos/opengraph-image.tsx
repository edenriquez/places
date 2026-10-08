import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";

export const alt = "Términos y condiciones de Entre Lugares";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    icon: "fileText",
    eyebrow: "Términos y condiciones",
    title: "Las reglas para usar la agenda",
    subtitle: "Cómo funciona, cómo publicar un evento y qué no se permite",
  });
}
