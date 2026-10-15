import { renderPostOg } from "@/lib/blog-og";
import { OG_SIZE } from "@/lib/og";

export const alt = "Guía para salir de la CDMX";
export const size = OG_SIZE;
export const contentType = "image/jpeg";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  return renderPostOg((await params).slug, "es");
}
