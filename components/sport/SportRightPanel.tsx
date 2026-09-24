"use client";

import Image from "next/image";
import Link from "@/components/ui/Link";
import { CalendarDays, Newspaper } from "lucide-react";

import { urlForImage } from "../../lib/sanity/image";
import SubmitClubButton from "./SubmitClubButton";
import {
  DAY_SHORT,
  formatSlotTime,
  type DaySlot,
  type SportNewsItem,
} from "../../lib/sanity/sport";

interface Props {
  day: number;
  slots: DaySlot[];
  news: SportNewsItem[];
  /** Set on a club profile — the news block then belongs to that club. */
  clubName?: string;
}

const DAY_FULL = [
  "недела",
  "понеделник",
  "вторник",
  "среда",
  "четврток",
  "петок",
  "сабота",
];

/** "пред 2 дена" / "денес" — a club post is only interesting while it is fresh. */
function ago(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "денес";
  if (days === 1) return "вчера";
  if (days < 30) return `пред ${days} дена`;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Skopje",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date(iso))
    .replace(/\//g, ".");
}

export default function SportRightPanel({ day, slots, news, clubName }: Props) {
  return (
    <div className="space-y-4 lg:p-3">
      {/* ── Today's trainings ─────────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays size={14} className="text-teal-500" />
            <p className="text-sm font-semibold text-zinc-500">Тренинзи денес</p>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-zinc-400">
            {DAY_SHORT[day]}
          </span>
        </div>

        {slots.length === 0 ? (
          <p className="text-xs italic text-zinc-400">
            Ниту еден клуб нема пријавен термин во {DAY_FULL[day]}.
          </p>
        ) : (
          <ul className="space-y-1">
            {slots.slice(0, 8).map((slot, i) => (
              <li key={`${slot.clubSlug}-${slot.group}-${i}`}>
                <Link
                  href={`/sport/${slot.clubSlug}`}
                  className="flex items-baseline gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-zinc-50"
                >
                  <span className="shrink-0 text-xs font-bold tabular-nums text-teal-600">
                    {formatSlotTime(slot)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-700">
                      {slot.club}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-400">
                      {[slot.group, slot.venue].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {slots.length > 8 ? (
          <p className="text-[10px] text-zinc-400">
            + уште {slots.length - 8} термини денес.
          </p>
        ) : null}
      </div>

      {/* ── News from the clubs ───────────────────────────────────────── */}
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-center gap-2">
          <Newspaper size={14} className="text-amber-500" />
          <p className="text-sm font-semibold text-zinc-500">
            {clubName ? "Новости" : "Новости од клубовите"}
          </p>
        </div>

        {news.length === 0 ? (
          <p className="text-xs italic text-zinc-400">
            {clubName
              ? `${clubName} сè уште нема објавено новост.`
              : "Уште нема објави од клубовите."}
          </p>
        ) : (
          <ul className="space-y-3">
            {news.map((item) => (
              <li key={item._id} className="flex gap-2.5">
                {item.image ? (
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    <Image
                      src={urlForImage(item.image).width(88).height(88).fit("crop").url()}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold leading-snug text-zinc-800">
                    {item.title}
                  </p>
                  {item.body ? (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
                      {item.body}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[10px] text-zinc-400">
                    {/* On a club profile the club name is the page title — repeating
                        it on every row is noise, so only the date is shown there. */}
                    {clubName || !item.club ? (
                      ago(item.publishedAt)
                    ) : (
                      <>
                        <Link
                          href={`/sport/${item.club.slug}`}
                          className="font-semibold text-zinc-500 hover:text-teal-600"
                        >
                          {item.club.name}
                        </Link>
                        {" · "}
                        {ago(item.publishedAt)}
                      </>
                    )}
                  </p>
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold text-teal-600"
                    >
                      Повеќе →
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Who may post ──────────────────────────────────────────────── */}
      <div className="space-y-1 rounded-2xl border border-zinc-200 bg-white p-4">
        <p className="text-sm font-bold text-zinc-900">Твојот клуб е тука?</p>
        <p className="text-xs leading-relaxed text-zinc-500">
          Профилот и новостите се бесплатни. Пријави го клубот и добиваш пристап
          за уредување преку твојата Мој Прилеп сметка.
        </p>
        <SubmitClubButton className="inline-block pt-1 text-xs font-semibold text-teal-600">
          Пријави клуб →
        </SubmitClubButton>
      </div>
    </div>
  );
}
