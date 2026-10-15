import type { Metadata } from "next";
import { PostView } from "@/components/blog/post-view";
import { postMetadata } from "@/lib/blog";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return postMetadata((await params).slug, "es");
}

export default async function PostPage({ params }: Params) {
  return <PostView slug={(await params).slug} locale="es" />;
}
