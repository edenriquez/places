import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";

export const alt = "Mapa de eventos en pueblos de Morelos, Estado de México, Puebla y CDMX";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    icon: "map",
    eyebrow: "Mapa de eventos",
    title: "Lo que está pasando cerca de ti, en el mapa",
    subtitle: "Elige a cuánto tiempo de camino y ve qué hay hoy y este fin de semana",
  });
}
