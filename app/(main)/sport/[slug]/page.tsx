/**
 * One club's profile.
 *
 * The order of the sections is the order the questions get asked: what is it →
 * for whom → when do they train → what does it cost → how do I reach them.
 * Anything the club left blank is omitted entirely rather than rendered as an
 * empty heading.
 */

import type { Metadata } from "next";
import Image from "next/image";
import Link from "@/components/ui/Link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";

import OwnerBar from "../../../../components/sport/OwnerBar";
import FollowButton from "../../../../components/sport/FollowButton";
import { urlForImage } from "../../../../lib/sanity/image";
import {
  AGE_LABEL,
  GENDER_LABEL,
  KIND_LABEL,
  LEVEL_LABEL,
  PERIOD_LABEL,
  fetchClubNews,
  fetchSportClub,
  fetchSportClubSlugs,
  formatDays,
  formatSlotTime,
} from "../../../../lib/sanity/sport";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await fetchSportClubSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await fetchSportClub(slug);
  if (!club) return { title: "Спортски клуб — Мој Прилеп" };
  return {
    title: `${club.name} — Спорт и Рекреација | Мој Прилеп`,
    description:
      club.shortDescription ??
      `${club.name} — ${(club.sports ?? []).join(", ")}. Распоред, цени и контакт.`,
  };
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-theme-heading">{title}</h2>
      {children}
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  // White pill + hairline border so it reads against the gray section, matching
  // the mobile app's club-profile tags (a bare bg-zinc-100 vanished on gray).
  return (
    <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
      {children}
    </span>
  );
}

/** "20.03.2026" — the stamp under the profile, so a reader can judge the age. */
function formatUpdated(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Skopje",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(new Date(iso))
    .replace(/\//g, ".");
}

/**
 * lucide-react dropped its brand glyphs, and no brand icon pack is installed —
 * so the network is named in text next to a neutral link icon. A label is
 * clearer than a logo here anyway: these sit in a row of small pills.
 */
const SOCIALS = [
  { key: "website", label: "Веб страна", Icon: Globe },
  { key: "facebook", label: "Facebook", Icon: Link2 },
  { key: "instagram", label: "Instagram", Icon: Link2 },
  { key: "youtube", label: "YouTube", Icon: Link2 },
] as const;

export default async function SportClubPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const club = await fetchSportClub(slug);
  if (!club) notFound();

  const news = await fetchClubNews(slug).catch(() => []);

  const hasContact =
    club.phone || club.email || SOCIALS.some(({ key }) => club[key]) || club.tiktok;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/sport" className="text-xs font-semibold text-teal-600">
          ← Спорт и Рекреација
        </Link>
        <OwnerBar slug={club.slug} />
      </div>

      {/* ── Hero card: cover + overlapping logo + identity + follow ─────── */}
      <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-zinc-100">
        {/* Cover — taller than before; a brand strip stands in when a club
            uploaded none, so the logo always has something to overlap. */}
        {club.coverImage ? (
          <div className="relative h-48 w-full bg-zinc-100 sm:h-60">
            <Image
              src={urlForImage(club.coverImage).width(1400).height(560).fit("crop").url()}
              alt={club.name}
              fill
              className="object-cover"
              priority
            />
          </div>
        ) : (
          <div className="h-28 w-full bg-gradient-to-r from-teal-500 to-teal-600 sm:h-32" />
        )}

        <div className="px-5 pb-5 sm:px-6 sm:pb-6">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {/* Logo — bigger, a white circle lifted above the cover. */}
            <div className="relative z-10 -mt-12 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-4 ring-white sm:-mt-16 sm:h-32 sm:w-32">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-zinc-100">
                {club.logo ? (
                  <Image
                    src={urlForImage(club.logo).width(256).height(256).fit("crop").url()}
                    alt={club.name}
                    width={128}
                    height={128}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">🏅</span>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-1.5">
                  <h1 className="min-w-0 text-lg font-bold leading-tight text-theme-heading sm:text-xl">
                    {club.name}
                  </h1>
                  {club.verified ? (
                    <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-teal-600" />
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-theme-muted">
                  {[KIND_LABEL[club.kind], (club.sports ?? []).join(", ")]
                    .filter(Boolean)
                    .join(" · ")}
                  {club.foundedYear ? ` · од ${club.foundedYear}` : ""}
                </p>
              </div>

              {/* Follow lives at the far right of the text row. */}
              <FollowButton slug={club.slug} />
            </div>
          </div>

          {club.shortDescription ? (
            <p className="mt-4 text-sm leading-relaxed text-theme-heading">
              {club.shortDescription}
            </p>
          ) : null}

          {/* "Прима нови членови" sits right under the title/subtitle, its border
              glowing gently to pull a prospective member's eye. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {club.freeTrial ? (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600">
                Прв тренинг бесплатно
              </span>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                club.acceptingMembers
                  ? "pp-accepting-glow bg-teal-50 text-teal-700"
                  : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {club.acceptingMembers ? "Прима нови членови" : "Уписот е затворен"}
            </span>
          </div>
        </div>
      </div>

      {/* ── About (own white card, right below the hero) ────────────────── */}
      {club.about ? (
        <div className="space-y-2 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
          <h2 className="text-sm font-semibold text-theme-heading">За клубот</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-theme-muted">
            {club.about}
          </p>
        </div>
      ) : null}

      {/* ── Location (right below the about section) ────────────────────── */}
      {club.venue || club.address || club.district ? (
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-zinc-100 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold text-theme-heading">Локација</h2>
          <p className="flex items-start gap-1.5 text-sm text-theme-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
            <span>
              {[club.venue, club.address, club.district].filter(Boolean).join(", ")}
            </span>
          </p>
        </div>
      ) : null}

      {/* ── Who it is for ───────────────────────────────────────────────── */}
      {(club.ageGroups ?? []).length || club.gender || (club.level ?? []).length ? (
        <Section title="За кого">
          <div className="flex flex-wrap gap-1.5">
            {(club.ageGroups ?? []).map((a) => (
              <Tag key={a}>{AGE_LABEL[a] ?? a}</Tag>
            ))}
            {club.gender && club.gender !== "mixed" ? (
              <Tag>{GENDER_LABEL[club.gender]}</Tag>
            ) : null}
            {(club.level ?? []).map((l) => (
              <Tag key={l}>{LEVEL_LABEL[l] ?? l}</Tag>
            ))}
          </div>
        </Section>
      ) : null}

      {/* ── News ────────────────────────────────────────────────────────── */}
      {news.length ? (
        <Section title="Новости">
          <ul className="space-y-2">
            {news.map((item) => (
              <li
                key={item._id}
                className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-3"
              >
                {item.image ? (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100">
                    <Image
                      src={urlForImage(item.image).width(112).height(112).fit("crop").url()}
                      alt=""
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="min-w-0 flex-1 text-sm font-semibold text-theme-heading">
                      {item.title}
                    </p>
                    {item.pinned ? (
                      <span className="shrink-0 text-[10px] font-bold text-amber-600">
                        Закачено
                      </span>
                    ) : null}
                  </div>
                  {item.body ? (
                    <p className="whitespace-pre-line text-xs leading-relaxed text-theme-muted">
                      {item.body}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[10px] text-zinc-400">
                    {formatUpdated(item.publishedAt)}
                  </p>
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-teal-600"
                    >
                      Повеќе →
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── Schedule ────────────────────────────────────────────────────── */}
      {(club.schedule ?? []).length ? (
        <Section title="Распоред на тренинзи">
          <ul className="space-y-2">
            {club.schedule.map((slot, i) => (
              <li
                key={`${slot.group}-${i}`}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-xl border border-zinc-200 bg-white p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-theme-heading">{slot.group}</p>
                  <p className="text-xs text-theme-muted">
                    {formatDays(slot.days)}
                    {slot.venue ? ` · ${slot.venue}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-zinc-100 px-2.5 py-1 text-sm font-bold tabular-nums text-theme-heading">
                  {formatSlotTime(slot)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── Prices ──────────────────────────────────────────────────────── */}
      {(club.pricing ?? []).length ? (
        <Section title="Ценовник">
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white">
            {club.pricing.map((item, i) => (
              <li
                key={`${item.label}-${i}`}
                className="flex items-baseline justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-theme-heading">{item.label}</p>
                  {item.note ? (
                    <p className="text-xs text-theme-muted">{item.note}</p>
                  ) : null}
                </div>
                <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-theme-heading">
                  {item.price} ден.
                  <span className="ml-1 text-[10px] font-semibold uppercase text-zinc-400">
                    {PERIOD_LABEL[item.period] ?? item.period}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {(() => {
        // A club often pastes the sign-up URL straight into the free-text field
        // instead of the dedicated link field. When `howToJoin` is nothing but a
        // URL, promote it to the button rather than showing a bare address.
        const joinText = (club.howToJoin ?? "").trim();
        const joinTextIsUrl = /^https?:\/\/\S+$/i.test(joinText);
        const joinLink = club.joinUrl || (joinTextIsUrl ? joinText : null);
        const joinBody = joinTextIsUrl ? null : club.howToJoin;
        return joinBody || joinLink ? (
          <Section title="Како да се зачлениш">
            {joinBody ? (
              <p className="whitespace-pre-line text-sm text-theme-muted">{joinBody}</p>
            ) : null}
            {joinLink ? (
              <a
                href={joinLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Зачлени се →
              </a>
            ) : null}
          </Section>
        ) : null;
      })()}

      {/* ── Coaches ─────────────────────────────────────────────────────── */}
      {(club.coaches ?? []).length ? (
        <Section title="Тренери">
          <ul className="flex flex-wrap gap-3">
            {club.coaches.map((coach, i) => (
              <li key={`${coach.name}-${i}`} className="flex items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-100">
                  {coach.photo ? (
                    <Image
                      src={urlForImage(coach.photo).width(72).height(72).fit("crop").url()}
                      alt={coach.name}
                      width={36}
                      height={36}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs">👤</span>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-theme-heading">{coach.name}</p>
                  {coach.role ? (
                    <p className="text-[10px] text-theme-muted">{coach.role}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {/* ── Contact ─────────────────────────────────────────────────────── */}
      {hasContact ? (
        <Section title="Контакт">
          <div className="flex flex-wrap gap-2">
            {club.phone ? (
              <a
                href={`tel:${club.phone.replace(/\s/g, "")}`}
                className="flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"
              >
                <Phone className="h-3.5 w-3.5" />
                {club.phone}
              </a>
            ) : null}
            {club.email ? (
              <a
                href={`mailto:${club.email}`}
                className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600"
              >
                <Mail className="h-3.5 w-3.5" />
                {club.email}
              </a>
            ) : null}
            {SOCIALS.map(({ key, label, Icon }) =>
              club[key] ? (
                <a
                  key={key}
                  href={club[key] as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </a>
              ) : null,
            )}
            {club.tiktok ? (
              <a
                href={club.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600"
              >
                TikTok
              </a>
            ) : null}
          </div>
        </Section>
      ) : null}

      {club.updatedAt ? (
        <p className="text-[11px] text-zinc-400">
          Последно ажурирано: {formatUpdated(club.updatedAt)}. Податоците ги
          внесува клубот.
        </p>
      ) : null}
    </div>
  );
}
