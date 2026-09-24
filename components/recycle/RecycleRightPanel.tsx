import Link from "@/components/ui/Link";
import {
  Lightbulb,
  Check,
  Ban,
  AlertTriangle,
  CalendarClock,
  ExternalLink,
} from "lucide-react";
import ShareSheet from "../ui/ShareSheet";
import { GLASS_CONTAINER_COUNT } from "../../lib/data/glassContainers";

const SHARE_URL = "https://mojprilep.mk/recycle";

export default function RecycleRightPanel() {
  return (
    <div className="space-y-3 lg:p-3">
      {/* Share — right side on desktop, bottom of the inline panel on mobile */}
      <ShareSheet
        url={SHARE_URL}
        title="Рециклирање на стакло во Прилеп"
        showLabel
        className="w-full justify-center rounded-2xl border border-theme bg-theme-surface px-4 py-2.5 text-xs text-theme-body hover:bg-theme-surface-muted"
      />

      {/* Numbers — each a full-width row */}
      <div className="flex flex-col gap-2">
        <StatRow value={`${GLASS_CONTAINER_COUNT}`} label="локации во градот" />
        <StatRow value="100%" label="стаклото е рециклабилно" />
        <StatRow value="1 000 000+" label="години се распаѓа стаклото" />
      </div>

      {/* Did you know */}
      <PanelCard title="Знаеше ли?" accent="teal" icon={<Lightbulb size={14} />}>
        Стаклото започнува како <strong>песок</strong> — природен материјал што
        преку одредени процеси станува дел од секојдневниот живот, а потоа
        корисен отпад.
      </PanelCard>

      {/* How to sort — do / don't in one card */}
      <div className="space-y-3 rounded-2xl border border-theme bg-theme-surface p-4">
        <p className="text-xs font-semibold text-theme-heading">
          Селектирање на стакло
        </p>
        <div className="flex items-start gap-2.5">
          <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
          <p className="text-xs leading-relaxed text-theme-muted">
            <strong className="text-theme-body">Селектирај</strong> стаклени
            шишиња и тегли — во контејнерите за стакло низ градот.
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <Ban size={15} className="mt-0.5 shrink-0 text-rose-500" />
          <p className="text-xs leading-relaxed text-theme-muted">
            <strong className="text-theme-body">Не одлагај</strong> стакло во
            домашната канта за селекција, во контејнерите за друг отпад, ниту во
            мешаниот комунален отпад.
          </p>
        </div>
      </div>

      {/* Tip */}
      <PanelCard
        title="Совет"
        accent="alert"
        icon={<CalendarClock size={14} />}>
        Собирај го стаклото дома и, дури и локацијата да е малку подалеку,
        одложувај го <strong>еднаш во месецот</strong>. Не е тешка задача.
      </PanelCard>

      {/* Alert for businesses — bright yellow left border signals ALERT */}
      <PanelCard
        title="Апел до угостителите"
        accent="yellow"
        icon={<AlertTriangle size={14} />}>
        Стаклената амбалажа <strong>задолжително</strong> одложувајте ја во
        контејнерите за стакло или преку HoReCa системот.
      </PanelCard>

      {/* Komunalec link */}
      <Link
        href="/utility/garbage"
        className="group flex items-center gap-3 rounded-2xl border border-theme bg-theme-surface px-4 py-3.5 transition-colors hover:bg-theme-surface-muted">
        <span className="text-xl">🗑️</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-theme-heading transition-colors group-hover:text-primary">
            ЈКП „Комуналец“ — Прилеп
          </p>
          <p className="mt-0.5 text-[11px] text-theme-subtle">
            Соопштенија, контакти и барања
          </p>
        </div>
        <ExternalLink
          size={13}
          className="shrink-0 text-theme-subtle transition-colors group-hover:text-primary"
        />
      </Link>

      {/* Closer */}
      <div
        style={{ borderLeftColor: "var(--color-primary)" }}
        className="rounded-2xl border border-theme border-l-4 bg-theme-surface px-4 py-4">
        <p className="text-sm font-bold tracking-wide text-primary">
          ЧИСТО Е УБАВО!
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-theme-muted">
          Стаклената амбалажа повеќе не смее да завршува на депонија или во
          природата.
        </p>
      </div>
    </div>
  );
}

function StatRow({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-theme bg-theme-surface px-4 py-3 text-center">
      <span className="whitespace-nowrap text-2xl font-bold text-blue-600 tabular-nums">
        {value}
      </span>
      <span className="text-xs text-theme-muted">{label}</span>
    </div>
  );
}

function PanelCard({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent: "teal" | "green" | "yellow" | "alert";
  children: React.ReactNode;
}) {
  // Inline color so it wins over `.border-theme { border-color }` in the cascade.
  const borderLeftColor = {
    teal: "var(--color-primary)",
    green: "#34d399",
    yellow: "#facc15",
    alert: "#ef4444",
  }[accent];
  const iconColor = {
    teal: "text-primary",
    green: "text-emerald-600",
    yellow: "text-yellow-500",
    alert: "text-red-500",
  }[accent];
  return (
    <div
      style={{ borderLeftColor }}
      className="rounded-2xl border border-theme border-l-4 bg-theme-surface p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-theme-heading">
        <span className={iconColor}>{icon}</span>
        {title}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-theme-muted">
        {children}
      </p>
    </div>
  );
}
