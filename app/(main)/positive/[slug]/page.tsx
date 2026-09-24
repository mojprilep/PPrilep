import Link from "@/components/ui/Link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PortableText, type PortableTextComponents } from "@portabletext/react";
import { fetchPositivePost } from "../../../../lib/sanity/queries";
import { urlForImage } from "../../../../lib/sanity/image";
import ClickableCover from "../../../../components/positive/ClickableCover";
import PostGallery from "../../../../components/positive/PostGallery";
import ShareSheet from "../../../../components/ui/ShareSheet";

// Convert a YouTube/Vimeo watch URL into an embeddable URL.
function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be"))
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { return null; }
  return null;
}

interface Props {
  params: Promise<{ slug: string }>;
}

export const revalidate = 60;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPositivePost(slug);
  if (!post) return { title: "Позитива — Подобар Прилеп" };
  return {
    title: `${post.title} — Позитива | Подобар Прилеп`,
    description: post.excerpt ?? undefined,
    openGraph: post.coverImage
      ? {
          images: [urlForImage(post.coverImage).width(1200).height(630).url()],
        }
      : undefined,
  };
}

// Renderers for PortableText rich-text blocks.
const portableTextComponents: PortableTextComponents = {
  types: {
    image: ({ value }: { value: { asset: { _ref: string }; alt?: string; caption?: string } }) => (
      <figure className="my-5 -mx-3 sm:mx-0">
        <Image
          src={urlForImage(value).width(800).url()}
          alt={value.alt ?? ""}
          width={800}
          height={450}
          className="w-full h-auto sm:rounded-xl"
        />
        {value.caption && (
          <figcaption className="text-xs text-zinc-500 mt-1.5 px-3 sm:px-0">
            {value.caption}
          </figcaption>
        )}
      </figure>
    ),
  },
  block: {
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold text-zinc-900 mt-6 mb-2">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-zinc-900 mt-4 mb-1.5">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-primary pl-3 italic text-zinc-700 my-3">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => (
      <p className="text-sm text-zinc-700 leading-relaxed my-2.5">{children}</p>
    ),
  },
  list: {
    bullet: ({ children }) => (
      <ul className="list-disc pl-5 my-2.5 text-sm text-zinc-700 space-y-1">{children}</ul>
    ),
    number: ({ children }) => (
      <ol className="list-decimal pl-5 my-2.5 text-sm text-zinc-700 space-y-1">{children}</ol>
    ),
  },
  marks: {
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2 hover:opacity-80">
        {children}
      </a>
    ),
  },
};

export default async function PositivePostPage({ params }: Props) {
  const { slug } = await params;
  const post = await fetchPositivePost(slug);
  if (!post) notFound();

  return (
    <article>
      <Link
        href="/positive"
        className="inline-block text-xs text-zinc-500 hover:text-zinc-700 mb-3">
        ← Позитива
      </Link>

      <header className="space-y-3">
        <h1 className="text-2xl font-bold text-zinc-900 leading-tight">{post.title}</h1>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            {post.author && <span className="font-medium text-zinc-700">{post.author.name}</span>}
            {post.author && <span>·</span>}
            <time dateTime={post.publishedAt}>
              {new Date(post.publishedAt).toLocaleDateString("mk-MK", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </time>
          </div>
          <ShareSheet
            url={`https://mojprilep.mk/positive/${slug}`}
            title={post.title}
            showLabel
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
          />
        </div>
      </header>

      {post.coverImage && (
        <ClickableCover
          src={urlForImage(post.coverImage).width(1200).height(675).url()}
          fullSrc={urlForImage(post.coverImage).width(2000).url()}
          alt={post.coverImage.alt ?? post.title}
        />
      )}

      {post.excerpt && (
        <p className="text-base text-zinc-600 leading-relaxed font-medium border-l-3 border-zinc-200 pl-3 my-4">
          {post.excerpt}
        </p>
      )}

      <div className="prose-content">
        {post.body && (
          <PortableText value={post.body as never} components={portableTextComponents} />
        )}
      </div>

      {/* Video embed */}
      {post.videoUrl && (
        <div className="my-5 space-y-2">
          {getEmbedUrl(post.videoUrl) && (
            <div className="overflow-hidden rounded-2xl bg-black">
              <div className="relative aspect-video w-full">
                <iframe
                  src={getEmbedUrl(post.videoUrl)!}
                  title="Видео"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            </div>
          )}
          {/* Always show direct link — fallback if embedding is disabled */}
          <a
            href={post.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-primary hover:bg-zinc-100 transition-colors">
            🎥 Отвори го видеото во нов прозорец →
          </a>
        </div>
      )}

      {post.gallery.length > 0 && (
        <PostGallery
          items={post.gallery.map((img) => ({
            src: urlForImage(img).width(600).height(600).url(),
            fullSrc: urlForImage(img).width(2000).url(),
            alt: img.alt ?? post.title,
            caption: img.caption,
          }))}
        />
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-6 pt-4 border-t border-zinc-100">
          {post.tags.map((t) => (
            <span
              key={t.slug}
              className="text-[11px] font-medium text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded-full">
              #{t.title}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
