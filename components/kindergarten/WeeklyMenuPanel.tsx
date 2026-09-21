"use client";

import { useState } from "react";
import type { MenuPost, DayMenu, AgeGroup } from "../../lib/sanity/kindergarten";

const DAY_KEYS: (keyof MenuPost)[] = ["monday","tuesday","wednesday","thursday","friday"];
const DAY_SHORT = ["Пон","Вто","Сре","Чет","Пет"];
const DAY_FULL  = ["Понеделник","Вторник","Среда","Четврток","Петок"];

const AGE_LABEL: Record<AgeGroup, string> = { under2: "До 2 год.", age2to6: "2–6 год." };
// Display order — youngest first — regardless of how Sanity returns them.
const AGE_ORDER: AgeGroup[] = ["under2", "age2to6"];

function todayIdx() {
  const d = new Date().getDay(); // 0=Sun
  return d >= 1 && d <= 5 ? d - 1 : 0;
}

interface Props { menus: MenuPost[] }

export default function WeeklyMenuPanel({ menus }: Props) {
  const [activeDay, setActiveDay] = useState(todayIdx());
  const [showAll, setShowAll] = useState(false);
  const [activeAge, setActiveAge] = useState(0);

  if (!menus || menus.length === 0) {
    return <p className="text-xs text-zinc-400 italic">Нема внесено мени.</p>;
  }

  // Order the age-group docs youngest-first. A legacy week has one doc with no
  // ageGroup — it just renders as a single menu with no age toggle.
  const ordered = [...menus].sort(
    (a, b) => AGE_ORDER.indexOf(a.ageGroup as AgeGroup) - AGE_ORDER.indexOf(b.ageGroup as AgeGroup),
  );
  const hasAgeToggle = ordered.length > 1;
  const menu = ordered[Math.min(activeAge, ordered.length - 1)];

  const day = menu[DAY_KEYS[activeDay]] as DayMenu | null;

  const ageTabs = hasAgeToggle && (
    <div className="flex gap-1">
      {ordered.map((m, i) => (
        <button
          key={m._id}
          onClick={() => setActiveAge(i)}
          className="flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors"
          style={activeAge === i
            ? { background: "#0f766e", color: "white" }
            : { background: "#e7f4f2", color: "#0f766e" }
          }>
          {AGE_LABEL[m.ageGroup as AgeGroup] ?? "Мени"}
        </button>
      ))}
    </div>
  );

  if (showAll) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-zinc-700">{menu.title}</p>
          <button onClick={() => setShowAll(false)} className="text-[11px] text-zinc-400 hover:text-zinc-700">
            Само денес ›
          </button>
        </div>
        {ageTabs}
        {DAY_KEYS.map((key, i) => {
          const d = menu[key] as DayMenu | null;
          if (!d) return null;
          return (
            <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50 p-3 space-y-1.5">
              <p className="text-[11px] font-bold text-zinc-500">{DAY_FULL[i]}</p>
              {d.breakfast && <p className="text-xs text-zinc-700"><span className="text-zinc-400">Појадок: </span>{d.breakfast}</p>}
              {d.snack1    && <p className="text-xs text-zinc-700"><span className="text-zinc-400">Ужина I: </span>{d.snack1}</p>}
              {d.lunch     && <p className="text-xs text-zinc-700"><span className="text-zinc-400">Ручек: </span>{d.lunch}</p>}
              {d.salad     && <p className="text-xs text-zinc-700"><span className="text-zinc-400">Салата: </span>{d.salad}</p>}
              {d.snack2    && <p className="text-xs text-zinc-700"><span className="text-zinc-400">Ужина II: </span>{d.snack2}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ageTabs}

      {/* Day tabs */}
      <div className="flex gap-1">
        {DAY_SHORT.map((label, i) => (
          <button
            key={i}
            onClick={() => setActiveDay(i)}
            className="flex-1 rounded-lg py-1.5 text-xs lg:text-[11px] font-semibold transition-colors"
            style={activeDay === i
              ? { background: "#2aa99d", color: "white" }
              : { background: "#f4f4f5", color: "#71717a" }
            }>
            {label}
          </button>
        ))}
      </div>

      {/* Today's meals */}
      {day ? (
        <div className="space-y-2">
          {day.breakfast && (
            <div>
              <p className="text-xs lg:text-[10px] font-semibold text-zinc-400">Појадок</p>
              <p className="text-xs text-zinc-700">{day.breakfast}</p>
            </div>
          )}
          {day.snack1 && (
            <div>
              <p className="text-xs lg:text-[10px] font-semibold text-zinc-400">Ужина I</p>
              <p className="text-xs text-zinc-700">{day.snack1}</p>
            </div>
          )}
          {day.lunch && (
            <div>
              <p className="text-xs lg:text-[10px] font-semibold text-zinc-400">Ручек</p>
              <p className="text-xs text-zinc-700 whitespace-pre-line">{day.lunch}</p>
            </div>
          )}
          {day.salad && (
            <div>
              <p className="text-xs lg:text-[10px] font-semibold text-zinc-400">Салата</p>
              <p className="text-xs text-zinc-700">{day.salad}</p>
            </div>
          )}
          {day.snack2 && (
            <div>
              <p className="text-xs lg:text-[10px] font-semibold text-zinc-400">Ужина II</p>
              <p className="text-xs text-zinc-700">{day.snack2}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-zinc-400 italic">Нема мени за овој ден.</p>
      )}

      <button
        onClick={() => setShowAll(true)}
        className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-800 transition-colors">
        Прикажи цела недела ›
      </button>
    </div>
  );
}
