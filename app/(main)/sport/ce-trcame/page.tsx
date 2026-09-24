/**
 * Че Трчаме 2026 — an informational page for the local road race, with direct
 * apply links to the organiser's registration (prileprun.mk). We do not host the
 * registration ourselves; the buttons hand off to the official event pages so
 * runners always land on the live entry form and start list.
 *
 * The content is static — copied from the organiser's page — because it changes
 * once a year. Update the constants below when the next edition is announced.
 */

import type { Metadata } from "next";
import Link from "@/components/ui/Link";
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  ExternalLink,
  Mail,
  Globe,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Че Трчаме 2026 — Спорт и Рекреација — Мој Прилеп",
  description:
    "Че Трчаме 2026 — рекреативно-натпреварувачка атлетска трка во Прилеп на 18 " +
    "октомври 2026. Трки на 5 и 10 км и детска трка. Пријави се онлајн.",
};

const EVENT = {
  register: "https://prileprun.mk/mk/events/ce-trcame-2026/register",
  register5k: "https://prileprun.mk/mk/events/ce-trcame-2026/register?event_package_id=178",
  register10k: "https://prileprun.mk/mk/events/ce-trcame-2026/register?event_package_id=179",
  startList: "https://prileprun.mk/mk/events/ce-trcame-2026/list",
  contact: "https://prileprun.mk/mk/events/ce-trcame-2026/contact",
  terms: "https://prileprun.mk/mk/events/ce-trcame-2026/terms-and-conditions",
  official: "https://www.prileprun.mk",
  facebook: "https://facebook.com/cetrcame",
  instagram: "https://instagram.com/che_trcame/",
  email: "cetrcameprilep@gmail.com",
} as const;

function Ext(props: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={props.href} target="_blank" rel="noopener noreferrer" className={props.className}>
      {props.children}
    </a>
  );
}

export default function CeTrcamePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sport"
          className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-theme-muted hover:text-theme-heading"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Спорт и Рекреација
        </Link>
        <h1 className="text-lg font-bold text-theme-heading">Че Трчаме 2026</h1>
        <p className="text-xs text-theme-muted">
          Рекреативно-натпреварувачка атлетска трка во Прилеп
        </p>
      </div>

      {/* Key facts + primary CTA */}
      <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-teal-800">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" /> 18 октомври 2026
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> 09:00
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> Прилеп — централно градско подрачје
          </span>
        </div>
        <Ext
          href={EVENT.register}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-teal-700 sm:w-auto"
        >
          Пријави се <ExternalLink className="h-4 w-4" />
        </Ext>
      </div>

      {/* Intro */}
      <div className="space-y-3 text-sm leading-relaxed text-theme-heading">
        <p>
          „Че Трчаме 2026“ е рекреативно-натпреварувачки атлетски настан кој по
          четврти пат ќе ги обедини професионалните атлетичари, рекреативците,
          клубовите и љубителите на трчањето од Македонија и регионот.
        </p>
        <p>
          Трката има за цел промоција на спортот, здравите животни навики,
          рекреацијата и спортскиот дух, како и промоција на градот Прилеп како
          спортска и туристичка дестинација.
        </p>
        <p>
          Учесниците ќе имаат можност да настапат на трки од 5 и 10 километри во
          машка и женска конкуренција, како и детска трка за најмладите учесници.
          Стартот и целта ќе бидат во централното градско подрачје.
        </p>
      </div>

      {/* Distances with apply links */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { d: "5 КМ", href: EVENT.register5k },
          { d: "10 КМ", href: EVENT.register10k },
        ].map((race) => (
          <div key={race.d} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <p className="text-base font-bold text-theme-heading">{race.d}</p>
            <p className="mt-0.5 text-xs text-theme-muted">
              Машка и женска конкуренција · старт 09:00
            </p>
            <Ext
              href={race.href}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-700"
            >
              Пријави се <ExternalLink className="h-3.5 w-3.5" />
            </Ext>
          </div>
        ))}
      </div>

      {/* Prize fund */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold text-theme-heading">Награден фонд</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">
              Трка на 10 км (мажи и жени)
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-theme-heading">
              <li>1 место — 25.000 денари</li>
              <li>2 место — 15.000 денари</li>
              <li>3 место — 10.000 денари</li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">
              Трка на 5 км (мажи и жени)
            </p>
            <ul className="mt-1 space-y-0.5 text-sm text-theme-heading">
              <li>1 место — 12.000 денари</li>
              <li>2 место — 8.000 денари</li>
              <li>3 место — 5.000 денари</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Entry fees */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold text-theme-heading">Котизации (5 и 10 км)</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wide text-theme-muted">
                <th className="py-2 pr-3 font-semibold">Период</th>
                <th className="px-2 py-2 text-right font-semibold">Без маичка</th>
                <th className="py-2 pl-2 text-right font-semibold">Со маичка</th>
              </tr>
            </thead>
            <tbody className="text-theme-heading">
              {[
                ["до 11.08", "600 ден", "900 ден"],
                ["12.08 – 20.09", "700 ден", "1.000 ден"],
                ["21.09 – 04.10", "800 ден", "1.100 ден"],
                ["05.10 – 12.10", "800 ден", "—"],
              ].map(([period, a, b]) => (
                <tr key={period} className="border-b border-zinc-50 last:border-0">
                  <td className="py-2 pr-3">{period}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{a}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-theme-muted">
          Рок за пријавување: 12.10.2026 во 23:59, или до пополнување на предвидениот
          број учесници.
        </p>
      </section>

      {/* What's included */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold text-theme-heading">За сите учесници</h2>
        <ul className="mt-2 grid gap-1.5 text-sm text-theme-heading sm:grid-cols-2">
          {[
            "Професионално мерење на време со чип",
            "Освежителни станици",
            "Финишер медал",
            "Електронска диплома",
            "Официјални фотографии",
            "Производи и подароци од спонзори",
            "Медицинска и волонтерска поддршка",
            "Маичка (опционално)",
          ].map((item) => (
            <li key={item} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* Links */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-bold text-theme-heading">Линкови и контакт</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Ext href={EVENT.startList} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <ExternalLink className="h-4 w-4" /> Види стартна листа
          </Ext>
          <Ext href={EVENT.terms} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <ExternalLink className="h-4 w-4" /> Услови и правила за трка
          </Ext>
          <Ext href={EVENT.contact} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <ExternalLink className="h-4 w-4" /> Контактирајте нè
          </Ext>
          <Ext href={EVENT.official} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <Globe className="h-4 w-4" /> prileprun.mk
          </Ext>
          <Ext href={EVENT.facebook} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <ExternalLink className="h-4 w-4" /> facebook.com/cetrcame
          </Ext>
          <Ext href={EVENT.instagram} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <ExternalLink className="h-4 w-4" /> @che_trcame
          </Ext>
          <a href={`mailto:${EVENT.email}`} className="inline-flex items-center gap-2 text-sm text-teal-700 hover:underline">
            <Mail className="h-4 w-4" /> {EVENT.email}
          </a>
        </div>
      </section>

      <p className="text-[11px] text-theme-muted">
        Пријавувањето и наплатата се водат од организаторот на prileprun.mk. „Мој
        Прилеп“ ги пренесува информациите и води кон официјалната страница.
      </p>
    </div>
  );
}
