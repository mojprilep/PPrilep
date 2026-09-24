"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "@/components/ui/Link";
import Image from "next/image";
import { urlForImage } from "../../../lib/sanity/image";
import {
  fetchAllAnnouncements,
  type KindergartenAnnouncement,
} from "../../../lib/sanity/kindergarten";
import { INSTITUTION_FALLBACK } from "../../../lib/kindergarten-fallback";
import { formatDays } from "../../../lib/utils";

export default function KindergartenPage() {
  const [announcements, setAnnouncements] = useState<KindergartenAnnouncement[]>([]);
  const [filter, setFilter] = useState<string | null>(null); // null = all

  useEffect(() => {
    fetchAllAnnouncements().then(setAnnouncements).catch(() => {});
  }, []);

  const filteredAnnouncements = useMemo(() => {
    if (!filter) return announcements;
    return announcements.filter(
      (a) => a.isGlobal || a.institutionSlug === filter,
    );
  }, [announcements, filter]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl bg-zinc-100">
          🌸
        </div>
        <div>
          <h1 className="text-sm font-bold text-zinc-900">Наша Иднина — Градинки</h1>
          <p className="text-xs text-zinc-500">6 установи во Прилеп</p>
        </div>
      </div>

      {/* Announcements feed */}
      {announcements.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-700">Соопштенија</p>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
              {filteredAnnouncements.length}
            </span>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-1.5">
            {[{ slug: null, label: "Сите" }, ...INSTITUTION_FALLBACK.map(i => ({ slug: i.slug, label: i.shortName }))].map(({ slug, label }) => (
              <button
                key={slug ?? "all"}
                onClick={() => setFilter(slug)}
                className="rounded-full px-5 py-2 text-xs font-semibold transition-colors"
                style={
                  filter === slug
                    ? { background: "#2aa99d", color: "white" }
                    : { background: "#f4f4f5", color: "#52525b" }
                }>
                {label}
              </button>
            ))}
          </div>

          {/* Feed */}
          <div className="space-y-3">
            {filteredAnnouncements.map((a) => (
              <AnnouncementCard key={a._id} announcement={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Announcement card ─────────────────────────────────────────────────────────

function AnnouncementCard({ announcement: a }: { announcement: KindergartenAnnouncement }) {
  const shortName = (name: string | null) =>
    name?.replace(/Градинка\s*(Наша Иднина|"Наша Иднина")\s*[-–—]?\s*/i, "").trim() ?? name;

  return (
    <Link
      href={`/kindergarten/announcement/${a._id}`}
      className="block rounded-2xl border border-zinc-200 bg-white overflow-hidden transition-all hover:border-zinc-300 hover:shadow-sm">
      {/* Cover image */}
      {a.coverImage && !a.videoFileUrl && !a.videoUrl && (
        <div className="relative h-64 w-full">
          <Image
            src={urlForImage(a.coverImage).width(600).height(280).url()}
            alt={a.title} fill sizes="(max-width: 640px) 100vw, 600px" className="object-cover"
          />
        </div>
      )}
      {/* Uploaded video — same height as the cover image */}
      {a.videoFileUrl && (
        <video src={a.videoFileUrl} controls className="h-64 w-full bg-black object-contain" preload="metadata" />
      )}
      {/* YouTube / Vimeo — same height as the cover image */}
      {!a.videoFileUrl && a.videoUrl && (() => {
        const yt = a.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/);
        const vm = a.videoUrl.match(/vimeo\.com\/(\d+)/);
        if (yt) return (
          <div className="relative h-64 w-full bg-black">
            <iframe src={`https://www.youtube.com/embed/${yt[1]}`}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
        );
        if (vm) return (
          <div className="relative h-64 w-full bg-black">
            <iframe src={`https://player.vimeo.com/video/${vm[1]}`}
              className="absolute inset-0 h-full w-full"
              allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          </div>
        );
        return null;
      })()}

      <div className="p-4 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-zinc-900 leading-snug">{a.title}</p>
          <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 whitespace-nowrap">
            {a.isGlobal ? "Сите установи" : shortName(a.institutionName)}
          </span>
        </div>
        {a.body && <p className="text-xs leading-relaxed text-zinc-600 whitespace-pre-line">{a.body}</p>}
        <div className="flex items-center justify-between pt-0.5">
          <p className="text-[11px] text-zinc-400">{formatDays(a.publishedAt)}</p>
          <span className="text-[11px] font-semibold text-[#2aa99d]">Отвори →</span>
        </div>
      </div>
    </Link>
  );
}
