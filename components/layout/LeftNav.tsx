"use client";

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  faHouse,
  faTriangleExclamation,
  faMedal,
  faLightbulb,
  faUsers,
  faDroplet,
  faTrashCan,
  faPlug,
  faBolt,
  faSun,
  faAddressCard,
  faHandshake,
  faDiagramProject,
  faBus,
  faSquareParking,
  faCalendarDays,
  faChildren,
  faRecycle,
  faBell,
  faCarSide,
  faBusSimple,
  faPersonRunning,
  faFutbol,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Map } from "lucide-react";
import { cn } from "../../lib/utils";
import { createClient } from "../../lib/supabase/client";
import { OWNER_EMAIL } from "../../lib/config/owner";

interface LeftNavItemProps {
  href: string;
  label: string;
  iconNode: React.ReactNode;
  iconTone?: IconTone;
  badge?: string;
  exact?: boolean;
  requireNoSearchParams?: boolean;
}

type IconTone =
  | "slate"
  | "red"
  | "blue"
  | "amber"
  | "green"
  | "orange"
  | "teal"
  | "indigo"
  | "violet"
  | "zinc"
  | "yellow"
  | "cyan"
  | "lime"
  | "sky"
  | "emerald";

function getIconToneClasses(tone: IconTone): string {
  switch (tone) {
    case "red":
      return "text-red-500 lg:group-hover:text-red-500";
    case "blue":
      return "text-blue-500 lg:group-hover:text-blue-500";
    case "amber":
      return "text-amber-500 lg:group-hover:text-amber-500";
    case "green":
      return "text-green-500 lg:group-hover:text-green-500";
    case "orange":
      return "text-orange-500 lg:group-hover:text-orange-500";
    case "teal":
      return "text-teal-500 lg:group-hover:text-teal-500";
    case "indigo":
      return "text-indigo-500 lg:group-hover:text-indigo-500";
    case "violet":
      return "text-violet-500 lg:group-hover:text-violet-500";
    case "zinc":
      return "text-zinc-500 lg:group-hover:text-zinc-500";
    case "yellow":
      return "text-yellow-500 lg:group-hover:text-yellow-500";
    case "cyan":
      return "text-cyan-500 lg:group-hover:text-cyan-500";
    case "lime":
      return "text-lime-500 lg:group-hover:text-lime-500";
    case "sky":
      return "text-sky-500 lg:group-hover:text-sky-500";
    case "emerald":
      return "text-emerald-500 lg:group-hover:text-emerald-500";
    case "slate":
    default:
      return "text-slate-500 lg:group-hover:text-slate-500";
  }
}

function LeftNavItem({
  href,
  label,
  iconNode,
  iconTone,
  badge,
  exact,
  requireNoSearchParams,
}: LeftNavItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hrefPath, hrefQueryString] = href.split("?");
  const hrefQuery = new URLSearchParams(hrefQueryString ?? "");

  const matchesQuery = Array.from(hrefQuery.entries()).every(
    ([key, value]) => searchParams.get(key) === value,
  );

  const active = hrefQueryString
    ? pathname === hrefPath && matchesQuery
    : exact
      ? pathname === hrefPath &&
        (!requireNoSearchParams || Array.from(searchParams.keys()).length === 0)
      : pathname.startsWith(hrefPath);

  return (
    <Link
      href={href}
      className={cn(
        "group flex select-none items-center gap-2.5 rounded-lg px-3 py-1.5 xl:py-2 text-[13px] lg:text-[12px] xl:text-[15px] font-medium text-theme-muted transition-all duration-150 ease-in-out cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#d9e1e8] focus-visible:ring-offset-2 focus-visible:ring-offset-(--theme-surface)",
        active
          ? "bg-slate-50 font-semibold text-theme-ink"
          : "hover:bg-slate-50 hover:text-theme-ink",
      )}>
      <span
        className={cn(
          "w-4 text-center transition-colors duration-150",
          active
            ? getIconToneClasses(iconTone ?? "slate")
            : cn("text-theme-muted", getIconToneClasses(iconTone ?? "slate")),
        )}>
        {iconNode}
      </span>
      {label}
      {badge ? (
        <span
          className={cn(
            "ml-auto rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-bold text-theme-muted",
            active && "bg-[#ccfbf1] text-theme-ink",
          )}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

const districts = [
  { value: "all", label: "Прилеп" },
  { value: "Center", label: "Центар" },
  { value: "Varoš", label: "Варош" },
  { value: "Trizla", label: "Тризла" },
  { value: "Točila", label: "Точила" },
  { value: "Rid", label: "Рид" },
  { value: "Tipski", label: "Типски" },
  { value: "Boncejca", label: "Бончејца" },
] as const;

export default function LeftNav() {
  const searchParams = useSearchParams();
  const activeDistrict = searchParams.get("district") ?? "all";
  const ACTIVE_CACHE_KEY = "nav_active_issues_count";
  const TOTAL_CACHE_KEY = "nav_total_issues_count";

  const [activeIssuesCount, setActiveIssuesCount] = useState(0);
  const [totalIssuesCount, setTotalIssuesCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // Show the admin section only to admins. Reads the signed-in user's
  // profiles.is_admin; RLS lets a user read their own row.
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      // The owner is always an admin here — mirrors the server, which also
      // accepts ADMIN_EMAIL that the client can't read.
      if (user.email === OWNER_EMAIL) {
        if (mounted) setIsAdmin(true);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (mounted) setIsAdmin(Boolean(data?.is_admin));
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    // Seed from cache after hydration — avoids SSR mismatch
    const cachedActive = localStorage.getItem(ACTIVE_CACHE_KEY);
    const cachedTotal = localStorage.getItem(TOTAL_CACHE_KEY);
    const seedId = setTimeout(() => {
      if (cachedActive) setActiveIssuesCount(parseInt(cachedActive, 10));
      if (cachedTotal) setTotalIssuesCount(parseInt(cachedTotal, 10));
    }, 0);

    let mounted = true;
    const supabase = createClient();

    async function loadActiveIssuesCount() {
      const [{ count: active }, { count: total }] = await Promise.all([
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .neq("status", "resolved"),
        supabase.from("issues").select("id", { count: "exact", head: true }),
      ]);

      if (mounted) {
        const a = active ?? 0;
        const t = total ?? 0;
        setActiveIssuesCount(a);
        setTotalIssuesCount(t);
        localStorage.setItem(ACTIVE_CACHE_KEY, String(a));
        localStorage.setItem(TOTAL_CACHE_KEY, String(t));
      }
    }

    loadActiveIssuesCount();

    return () => {
      clearTimeout(seedId);
      mounted = false;
    };
  }, []);

  return (
    <nav data-tour="menu" className="scrollbar-hidden flex h-full min-h-0 flex-col gap-5 overflow-y-auto py-3">
      <section data-tour="menu-citizens">
        <p className="text-nav-section mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.06em]">
          Граѓани
        </p>
        <div className="flex flex-col gap-1 ">
          <LeftNavItem
            href="/"
            label="Почетна"
            iconNode={<FontAwesomeIcon icon={faHouse} className="h-4 w-4" />}
            iconTone="slate"
            exact
          />
          <LeftNavItem
            href="/issues"
            label="Пријави"
            badge={`${activeIssuesCount}/${totalIssuesCount}`}
            iconNode={
              <FontAwesomeIcon
                icon={faTriangleExclamation}
                className="h-4 w-4"
              />
            }
            iconTone="red"
          />
          <div className="pl-5">
            <LeftNavItem
              href="/map"
              label="Мапа на пријави"
              iconNode={<Map className="h-4 w-4" />}
              iconTone="blue"
            />
          </div>
          <LeftNavItem
            href="/heroes"
            label="Херои"
            iconNode={<FontAwesomeIcon icon={faMedal} className="h-4 w-4" />}
            iconTone="amber"
          />
          <LeftNavItem
            href="/initiatives"
            label="Иницијативи"
            iconNode={
              <FontAwesomeIcon icon={faLightbulb} className="h-4 w-4" />
            }
            iconTone="orange"
          />
          <LeftNavItem
            href="/communities"
            label="Населби"
            iconNode={<FontAwesomeIcon icon={faUsers} className="h-4 w-4" />}
            iconTone="teal"
          />
        </div>
      </section>

      <section data-tour="menu-platform">
        <p className="text-nav-section mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.06em]">
          За Мој Прилеп
        </p>
        <div className="flex flex-col gap-1 ">
          <LeftNavItem
            href="/about"
            label="За нас"
            iconNode={
              <FontAwesomeIcon icon={faAddressCard} className="h-4 w-4" />
            }
            iconTone="indigo"
          />
          <LeftNavItem
            href="/projects"
            label="Наши Проекти"
            iconNode={
              <FontAwesomeIcon icon={faDiagramProject} className="h-4 w-4" />
            }
            iconTone="violet"
          />
          <LeftNavItem
            href="/sponsors"
            label="Членови / Партнери"
            iconNode={
              <FontAwesomeIcon icon={faHandshake} className="h-4 w-4" />
            }
            iconTone="zinc"
          />
        </div>
      </section>

      <section data-tour="menu-info">
        <p className="text-nav-section mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.06em]">
          Информации
        </p>
        <div className="flex flex-col gap-1">
          <LeftNavItem
            href="/positive"
            label="Позитива"
            iconNode={<FontAwesomeIcon icon={faSun} className="h-4 w-4" />}
            iconTone="yellow"
          />
          <LeftNavItem
            href="/events"
            label="Случувања"
            iconNode={
              <FontAwesomeIcon icon={faCalendarDays} className="h-4 w-4" />
            }
            iconTone="cyan"
          />
          <LeftNavItem
            href="/recycle"
            label="Рециклирање"
            iconNode={<FontAwesomeIcon icon={faRecycle} className="h-4 w-4" />}
            iconTone="green"
          />
          <LeftNavItem
            href="/sport"
            label="Спорт и Рекреација"
            iconNode={<FontAwesomeIcon icon={faMedal} className="h-4 w-4" />}
            iconTone="orange"
            exact
          />
          <div className="pl-5">
            <LeftNavItem
              href="/sport/ce-trcame"
              label="Че Трчаме 2026"
              iconNode={<FontAwesomeIcon icon={faPersonRunning} className="h-4 w-4" />}
              iconTone="teal"
            />
            <LeftNavItem
              href="/sport/raspored"
              label="Лига регион 4"
              iconNode={<FontAwesomeIcon icon={faFutbol} className="h-4 w-4" />}
              iconTone="orange"
            />
          </div>
        </div>
      </section>

      <section data-tour="menu-enterprise">
        <p className="text-nav-section mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.06em]">
          Јавни Претпријатија
        </p>
        <div className="flex flex-col gap-1">
          <LeftNavItem
            href="/utility/water"
            label="Водовод"
            iconNode={<FontAwesomeIcon icon={faDroplet} className="h-4 w-4" />}
            iconTone="blue"
          />
          <LeftNavItem
            href="/utility/garbage"
            label="Комуналец"
            iconNode={<FontAwesomeIcon icon={faTrashCan} className="h-4 w-4" />}
            iconTone="lime"
          />
          <LeftNavItem
            href="/utility/power"
            label="Осветлување"
            iconNode={<FontAwesomeIcon icon={faPlug} className="h-4 w-4" />}
            iconTone="amber"
          />
          <LeftNavItem
            href="/utility/electricity"
            label="Струја — ЕВН"
            iconNode={<FontAwesomeIcon icon={faBolt} className="h-4 w-4" />}
            iconTone="orange"
          />
          <LeftNavItem
            href="/kindergarten"
            label="Градинки — Наша Иднина"
            iconNode={<FontAwesomeIcon icon={faChildren} className="h-4 w-4" />}
            iconTone="emerald"
          />
        </div>
      </section>

      {/* Mirrors the mobile drawer's "Превоз и Паркинг". These two used to sit
          at the bottom of Претпријатие among the utilities, where nobody went
          looking for a bus time. Такси and Автобуска станица exist on mobile
          only for now — they join this section once the web pages land. */}
      <section data-tour="menu-transport">
        <p className="text-nav-section mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.06em]">
          Превоз и Паркинг
        </p>
        <div className="flex flex-col gap-1">
          <LeftNavItem
            href="/prevoz"
            label="Градски превоз"
            iconNode={<FontAwesomeIcon icon={faBus} className="h-4 w-4" />}
            iconTone="violet"
          />
          <LeftNavItem
            href="/taxi"
            label="Такси"
            iconNode={<FontAwesomeIcon icon={faCarSide} className="h-4 w-4" />}
            iconTone="yellow"
          />
          <LeftNavItem
            href="/bus-station"
            label="Автобуска станица"
            iconNode={
              <FontAwesomeIcon icon={faBusSimple} className="h-4 w-4" />
            }
            iconTone="sky"
          />
          <LeftNavItem
            href="/utility/parking"
            label="Паркинзи"
            iconNode={
              <FontAwesomeIcon icon={faSquareParking} className="h-4 w-4" />
            }
            iconTone="teal"
          />
        </div>
      </section>

      {isAdmin ? (
        <section>
          <p className="text-nav-section mb-2 px-3 text-[8px] font-semibold uppercase tracking-[0.06em]">
            Администрација
          </p>
          <div className="flex flex-col gap-1">
            <LeftNavItem
              href="/admin/reminders"
              label="Потсетници за настани"
              iconNode={<FontAwesomeIcon icon={faBell} className="h-4 w-4" />}
              iconTone="red"
            />
            <LeftNavItem
              href="/admin/water"
              label="Водовод — админ"
              iconNode={<FontAwesomeIcon icon={faDroplet} className="h-4 w-4" />}
              iconTone="blue"
            />
          </div>
        </section>
      ) : null}

      <section className=" rounded-3xl p-3 ">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-nav-section text-[8px] font-semibold uppercase tracking-[0.06em]">
            Филтер по мапа
          </p>
          <Link
            href="/issues"
            className="text-nav-reset text-[9px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#d9e1e8] focus-visible:ring-offset-2 focus-visible:ring-offset-(--theme-surface)">
            Ресет
          </Link>
        </div>

        <div className="">
          <div className="text-nav-district-grid grid grid-cols-3 gap-2 text-center text-[10px] font-semibold">
            {districts.map((d) => (
              <Link
                key={d.value}
                href={
                  d.value === "all"
                    ? "/issues"
                    : `/issues?district=${encodeURIComponent(d.value)}`
                }
                className={cn(
                  "nav-district-btn rounded-xl border px-2 py-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#d9e1e8] focus-visible:ring-offset-2 focus-visible:ring-offset-(--theme-surface)",
                  activeDistrict === d.value
                    ? "nav-district-btn-active"
                    : "nav-district-btn-idle",
                )}>
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </nav>
  );
}
