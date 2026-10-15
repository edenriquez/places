import { BlogIndex } from "@/components/blog/blog-index";
import { blogIndexMetadata } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata = blogIndexMetadata("es");

export default function BlogPage() {
  return <BlogIndex locale="es" />;
}
