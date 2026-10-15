import { renderBlogOg } from "@/lib/blog-og";
import { OG_SIZE, OG_TYPE } from "@/lib/og";

export const alt = "Guías de Entre Lugares: ferias, fiestas y escapadas cerca de la CDMX";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderBlogOg("es");
}
