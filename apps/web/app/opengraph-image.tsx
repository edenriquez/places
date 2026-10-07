import { OG_SIZE, OG_TYPE, renderOg } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME}: ferias, fiestas y eventos en pueblos cerca de la Ciudad de México`;
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** Vista previa por defecto: la portada y cualquier página sin imagen propia. */
export default function Image() {
  return renderOg({
    icon: "brand",
    eyebrow: "Qué hacer este fin de semana",
    title: "Ferias, fiestas y eventos en pueblos cerca de ti",
    subtitle: "Morelos · Estado de México · Puebla · CDMX",
    chips: ["Gratis y de paga", "Con mapa"],
  });
}
