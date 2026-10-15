import { BlogIndex } from "@/components/blog/blog-index";
import { blogIndexMetadata } from "@/lib/blog";

export const dynamic = "force-dynamic";

export const metadata = blogIndexMetadata("en");

export default function BlogPageEn() {
  return <BlogIndex locale="en" />;
}
