import { ImageResponse } from "next/og";
import { eventBySlug } from "@/lib/queries";
import { flyerUrl, fmtWhenLong } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await eventBySlug(slug);
  const title = data?.event.title ?? "Entre Lugares";
  const when = data?.occurrences[0] ? fmtWhenLong(data.occurrences[0].starts_at, data.occurrences[0].ends_at, data.occurrences[0].is_all_day) : "";
  const where = data ? [data.place?.name ?? data.event.place_text, data.municipality?.name].filter(Boolean).join(" · ") : "";
  const img = data ? flyerUrl(data.event.image_path) : null;
  const price = data ? (data.event.is_free ? "Gratis" : data.event.price_min != null ? `$${Math.round(data.event.price_min)}` : "") : "";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ width: 480, height: "100%", background: "#f7f7f7", display: "flex", overflow: "hidden" }}>
          {img && <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "#FF385C", fontSize: 26, fontWeight: 700 }}>
            <div style={{ width: 20, height: 20, borderRadius: 999, background: "#FF385C" }} />
            Entre Lugares
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 56, fontWeight: 800, color: "#222", lineHeight: 1.1 }}>{title}</div>
            <div style={{ fontSize: 30, color: "#6a6a6a" }}>{when}</div>
            <div style={{ fontSize: 28, color: "#6a6a6a" }}>{where}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: price === "Gratis" ? "#008A05" : "#222" }}>{price}</div>
            <div style={{ fontSize: 22, color: "#9a9a9a" }}>entrelugares.mx</div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
