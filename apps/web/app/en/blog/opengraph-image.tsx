import { renderBlogOg } from "@/lib/blog-og";
import { OG_SIZE, OG_TYPE } from "@/lib/og";

export const alt = "Entre Lugares guides: festivals, fairs and day trips from Mexico City";
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default function Image() {
  return renderBlogOg("en");
}
