import { ExploreView, type ExploreParams } from "./explore-view";

export const dynamic = "force-dynamic";

export default async function ExplorePage({ searchParams }: { searchParams: Promise<ExploreParams> }) {
  return <ExploreView sp={await searchParams} />;
}
