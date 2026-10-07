import { JsonLd } from "@/components/json-ld";
import { pageMetadata, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { siteGraph } from "@/lib/structured-data";
import { ExploreView, type ExploreParams } from "./explore-view";

export const dynamic = "force-dynamic";

// los filtros (?r=, ?c=) son la misma página: el canonical siempre es la portada
export const metadata = pageMetadata({
  title: `${SITE_NAME}: ferias, fiestas y eventos en pueblos cerca de ti`,
  ogTitle: "Qué hacer este fin de semana en pueblos cerca de ti",
  description: SITE_DESCRIPTION,
  path: "/",
  absolute: true,
});

export default async function ExplorePage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  return (
    <>
      <JsonLd data={siteGraph()} />
      <ExploreView sp={await searchParams} />
    </>
  );
}
