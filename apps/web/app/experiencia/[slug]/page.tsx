import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DesktopHeader } from "@/components/desktop";
import { ExperienceDesktop, ExperienceMobile } from "@/components/experience-detail";
import { JsonLd } from "@/components/json-ld";
import { SearchBar } from "@/components/location-picker";
import { EXPERIENCE_KINDS, fmtExperiencePrice } from "@/lib/experiences";
import { flyerUrl } from "@/lib/format";
import { getLoc, hasLoc } from "@/lib/location-server";
import { experienceBySlug, municipalities } from "@/lib/queries";
import { clip, pageMetadata } from "@/lib/site";
import { breadcrumbs, experienceGraph } from "@/lib/structured-data";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await experienceBySlug(slug);
  if (!data) return { title: "Experiencia no encontrada", robots: { index: false, follow: true } };
  const { experience: x, place, municipality } = data;
  const where = [place?.name ?? x.place_text, municipality && `${municipality.name}, ${municipality.state}`].filter(Boolean).join(", ");
  const t = x.title.toLowerCase();
  const title = !municipality || t.includes(municipality.name.toLowerCase()) ? x.title : `${x.title} en ${municipality.name}`;
  const price = fmtExperiencePrice(x);
  const summary = [EXPERIENCE_KINDS[x.kind]?.label, where, x.availability_text, price !== "Consultar" ? price : null].filter(Boolean).join(" · ");
  const img = flyerUrl(x.image_path);
  return pageMetadata({
    title,
    ogTitle: x.title,
    description: clip(x.description ? `${summary}. ${x.description}` : `${summary}.`),
    path: `/experiencia/${x.slug}`,
    ...(img && { images: [{ url: img, alt: x.title }] }),
  });
}

export default async function ExperiencePage({ params }: Params) {
  const { slug } = await params;
  const data = await experienceBySlug(slug);
  if (!data) notFound();
  const [loc, isSet, munis] = await Promise.all([getLoc(), hasLoc(), municipalities()]);
  const m = data.municipality;
  const crumbs = [
    { name: "Explorar", path: "/" },
    ...(m ? [{ name: m.name, path: `/municipio/${m.slug}` }] : []),
    ...(m && data.place ? [{ name: data.place.name, path: `/municipio/${m.slug}/${data.place.slug}` }] : []),
    { name: data.experience.title, path: `/experiencia/${data.experience.slug}` },
  ];

  return (
    <>
      <JsonLd data={[experienceGraph(data), breadcrumbs(crumbs)]} />
      <div className="lg:hidden"><ExperienceMobile d={data} /></div>
      <div className="hidden lg:block">
        <DesktopHeader><SearchBar loc={loc} municipalities={munis} isSet={isSet} header /></DesktopHeader>
        <ExperienceDesktop d={data} />
      </div>
    </>
  );
}
