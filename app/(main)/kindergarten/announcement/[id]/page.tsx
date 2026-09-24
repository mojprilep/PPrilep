import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { fetchAnnouncementById } from "@/lib/sanity/kindergarten";
import { urlForImage } from "@/lib/sanity/image";
import ShareSheet from "@/components/ui/ShareSheet";
import AnnouncementMedia from "@/components/kindergarten/AnnouncementMedia";

const BASE_URL = "https://mojprilep.mk";

interface Props {
  params: Promise<{ id: string }>;
}

// ── Date formatting (no Intl → identical on server + client) ─────────────────
const MK_MONTHS_FULL = [
  "јануари", "февруари", "март", "април", "мај", "јуни",
  "јули", "август", "септември", "октомври", "ноември", "декември",
];

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MK_MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

const shortName = (name: string | null) =>
  name?.replace(/Градинка\s*(Наша Иднина|"Наша Иднина")\s*[-–—]?\s*/i, "").trim() ?? name;

// ── Metadata (Facebook/Twitter share cards) ──────────────────────────────────
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = await fetchAnnouncementById(decodeURIComponent(id));
  if (!a) return {};

  const firstImg = a.coverImage ?? a.gallery?.[0] ?? null;
  const image = firstImg ? urlForImage(firstImg).width(1200).height(630).url() : undefined;
  const description = a.body ?? (a.isGlobal ? "Сите установи" : shortName(a.institutionName)) ?? undefined;

  return {
    title: a.title,
    description,
    openGraph: {
      type: "article",
      title: a.title,
      description,
      url: `${BASE_URL}/kindergarten/announcement/${a._id}`,
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function AnnouncementDetailPage({ params }: Props) {
  const { id } = await params;
  const a = await fetchAnnouncementById(decodeURIComponent(id));
  if (!a) notFound();

  const shareUrl = `${BASE_URL}/kindergarten/announcement/${a._id}`;
  const badge = a.isGlobal ? "Сите установи" : shortName(a.institutionName);

  const hasVideo = Boolean(a.videoFileUrl || a.videoUrl);
  const coverMedia = a.coverImage && !hasVideo
    ? {
        thumb: urlForImage(a.coverImage).width(1200).height(600).url(),
        full: urlForImage(a.coverImage).width(1600).fit("max").url(),
      }
    : null;
  const galleryMedia = (a.gallery ?? []).map((img) => ({
    thumb: urlForImage(img).width(800).height(600).url(),
    full: urlForImage(img).width(1600).fit("max").url(),
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/kindergarten"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-muted transition-colors hover:text-theme-heading">
        <ArrowLeft size={15} /> Сите соопштенија
      </Link>

      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Cover image (shown only when there is no video) — zoomable */}
        {coverMedia && (
          <AnnouncementMedia cover={coverMedia} gallery={[]} alt={a.title} />
        )}
        {/* Uploaded video — same height as the cover image */}
        {a.videoFileUrl && (
          <video src={a.videoFileUrl} controls className="h-56 w-full bg-black object-contain sm:h-72" preload="metadata" />
        )}
        {/* YouTube / Vimeo — same height as the cover image */}
        {!a.videoFileUrl && a.videoUrl && (() => {
          const yt = a.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
          const vm = a.videoUrl.match(/vimeo\.com\/(\d+)/);
          if (yt) return (
            <div className="relative h-56 w-full bg-black sm:h-72">
              <iframe src={`https://www.youtube.com/embed/${yt[1]}`}
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen />
            </div>
          );
          if (vm) return (
            <div className="relative h-56 w-full bg-black sm:h-72">
              <iframe src={`https://player.vimeo.com/video/${vm[1]}`}
                className="absolute inset-0 h-full w-full"
                allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            </div>
          );
          return null;
        })()}

        {/* Body */}
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold leading-snug text-theme-heading">{a.title}</h1>
            <span className="mt-1 shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500 whitespace-nowrap">
              {badge}
            </span>
          </div>

          <p className="text-xs text-zinc-400">{fmtDate(a.publishedAt)}</p>

          {a.body && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-700">{a.body}</p>
          )}

          {/* Gallery — zoomable, full-screen viewer */}
          {galleryMedia.length > 0 && (
            <AnnouncementMedia cover={null} gallery={galleryMedia} alt={a.title} />
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4">
            <ShareSheet
              url={shareUrl}
              title={a.title}
              showLabel
              className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
            />
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f66d0]">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </svg>
              Сподели на Facebook
            </a>
            {a.link && (
              <a
                href={a.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-700">
                <ExternalLink size={14} /> Отвори линк
              </a>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
