import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";

export const alt = "Publica tu evento gratis en Entre Lugares";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderOg({
    icon: "megaphone",
    eyebrow: "Para organizadores",
    title: "Publica tu evento gratis",
    subtitle: "Sube el flyer: nosotros armamos la ficha con fecha, lugar y precio",
    chips: ["Ferias", "Fiestas", "Conciertos"],
  });
}
