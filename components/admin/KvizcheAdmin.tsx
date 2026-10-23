"use client";

/**
 * /admin/kvizche — weekly themes and their seven questions. Each week is a
 * draft until published (all 7 days must be filled in). Every action
 * re-renders the server page (router.refresh) for fresh data.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import {
  deleteKvizcheQuestion,
  deleteKvizcheWeek,
  saveKvizcheQuestion,
  saveKvizcheWeek,
  setKvizcheWeekPublished,
  type AdminKvizcheWeek,
} from "../../app/actions/kvizche";
import { addDays, DAY_NAMES, OPTIONS_BY_DAY, TIMELINE_MAX, TIMELINE_MIN } from "../../lib/kvizche";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-teal-500";
const btn =
  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50";
const card = "space-y-3 rounded-2xl border border-zinc-200 bg-white p-4";

type Run = (action: () => Promise<{ error?: string }>, ok?: string) => void;

function shortDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

export default function KvizcheAdmin({ weeks }: { weeks: AdminKvizcheWeek[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  /** Run an action, toast its error or the success text, then refresh. */
  const run: Run = (action, ok) => {
    start(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else {
        if (ok) toast.success(ok);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <WeekForm week={null} pending={pending} run={run} />
      {weeks.map((w) => (
        <WeekCard key={w.id} week={w} pending={pending} run={run} />
      ))}
    </div>
  );
}

function WeekForm({ week, pending, run }: { week: AdminKvizcheWeek | null; pending: boolean; run: Run }) {
  const [weekStart, setWeekStart] = useState(week?.week_start ?? "");
  const [theme, setTheme] = useState(week?.theme ?? "");
  const [intro, setIntro] = useState(week?.intro ?? "");
  const [cover, setCover] = useState(week?.cover_url ?? "");
  return (
    <div className={week ? "space-y-2" : card}>
      {!week && <h2 className="text-sm font-semibold">Нова недела</h2>}
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <label className="text-xs text-zinc-500">
          Понеделник
          <input type="date" className={input} value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        </label>
        <label className="text-xs text-zinc-500">
          Тема
          <input className={input} value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={120} />
        </label>
      </div>
      <label className="block text-xs text-zinc-500">
        Вовед (се прикажува над прашањата)
        <textarea className={input} rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />
      </label>
      <label className="block text-xs text-zinc-500">
        Насловна слика (URL, по желба)
        <input className={input} value={cover} onChange={(e) => setCover(e.target.value)} />
      </label>
      <button
        type="button"
        disabled={pending}
        className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}
        onClick={() =>
          run(
            () => saveKvizcheWeek({ id: week?.id, week_start: weekStart, theme, intro, cover_url: cover }),
            week ? "Зачувано." : "Неделата е креирана.",
          )
        }
      >
        {week ? "Зачувај" : (
          <>
            <Plus size={14} /> Креирај
          </>
        )}
      </button>
    </div>
  );
}

function WeekCard({ week, pending, run }: { week: AdminKvizcheWeek; pending: boolean; run: Run }) {
  const [editing, setEditing] = useState(false);
  const filled = week.questions.length;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">{week.theme}</h2>
          <p className="text-xs text-zinc-500">
            {shortDate(week.week_start)} – {shortDate(addDays(week.week_start, 6))} · {filled}/7 прашања ·{" "}
            <span className={week.published ? "font-semibold text-teal-700" : "text-amber-700"}>
              {week.published ? "објавено" : "нацрт"}
            </span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <button type="button" className={`${btn} bg-zinc-100 hover:bg-zinc-200`} onClick={() => setEditing((v) => !v)}>
            {editing ? "Затвори" : "Уреди"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={`${btn} ${week.published ? "bg-zinc-100 hover:bg-zinc-200" : "bg-teal-600 text-white hover:bg-teal-700"}`}
            onClick={() =>
              run(
                () => setKvizcheWeekPublished(week.id, !week.published),
                week.published ? "Скриено." : "Објавено.",
              )
            }
          >
            {week.published ? <EyeOff size={14} /> : <Eye size={14} />}
            {week.published ? "Скриј" : "Објави"}
          </button>
          <button
            type="button"
            disabled={pending}
            className={`${btn} text-red-600 hover:bg-red-50`}
            onClick={() => {
              if (confirm(`Да се избрише „${week.theme}“ со сите прашања и одговори?`))
                run(() => deleteKvizcheWeek(week.id), "Избришано.");
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {editing && <WeekForm week={week} pending={pending} run={run} />}
      <div className="space-y-2">
        {DAY_NAMES.map((_, i) => (
          <QuestionEditor
            key={`${week.id}-${i + 1}-${week.questions.find((q) => q.day === i + 1)?.id ?? "new"}`}
            week={week}
            day={i + 1}
            pending={pending}
            run={run}
          />
        ))}
      </div>
    </section>
  );
}

function QuestionEditor({
  week,
  day,
  pending,
  run,
}: {
  week: AdminKvizcheWeek;
  day: number;
  pending: boolean;
  run: Run;
}) {
  const q = week.questions.find((x) => x.day === day) ?? null;
  const timeline = day === 7;
  const slots = timeline ? Math.max(TIMELINE_MAX, q?.options.length ?? 0) : OPTIONS_BY_DAY[day - 1];
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(q?.prompt ?? "");
  const [options, setOptions] = useState<string[]>(() =>
    Array.from({ length: slots }, (_, i) => q?.options[i] ?? ""),
  );
  const [correct, setCorrect] = useState<number>(q?.correct_index ?? 0);
  const [explanation, setExplanation] = useState(q?.explanation ?? "");
  const [image, setImage] = useState(q?.image_url ?? "");

  return (
    <div className="rounded-xl border border-zinc-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        <span className="w-24 shrink-0 font-semibold">{DAY_NAMES[day - 1]}</span>
        <span className="w-24 shrink-0 text-xs text-zinc-500">
          {timeline ? "хронологија" : `${OPTIONS_BY_DAY[day - 1]} одговори`}
        </span>
        <span className={`min-w-0 flex-1 truncate ${q ? "text-zinc-800" : "italic text-zinc-400"}`}>
          {q?.prompt ?? "празно"}
        </span>
        {q && q.answered > 0 && (
          <span className="shrink-0 text-xs text-zinc-500">
            {q.correct}/{q.answered} точно
          </span>
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-zinc-200 p-3">
          <label className="block text-xs text-zinc-500">
            Прашање
            <textarea className={input} rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <p className="text-xs text-zinc-500">
            {timeline
              ? `Настаните по ТОЧНИОТ хронолошки редослед (${TIMELINE_MIN}–${TIMELINE_MAX}; играчите ги добиваат измешани).`
              : "Одговори — означете го точниот."}
          </p>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              {timeline ? (
                <span className="w-5 text-right text-xs text-zinc-500">{i + 1}.</span>
              ) : (
                <input
                  type="radio"
                  name={`correct-${week.id}-${day}`}
                  checked={correct === i}
                  onChange={() => setCorrect(i)}
                  aria-label="Точен одговор"
                />
              )}
              <input
                className={input}
                value={o}
                maxLength={200}
                placeholder={timeline && i >= TIMELINE_MIN ? "(по желба)" : ""}
                onChange={(e) => setOptions((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
              />
            </div>
          ))}
          <label className="block text-xs text-zinc-500">
            „Дали знаеше?“ — објаснување по одговорот
            <textarea
              className={input}
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
            />
          </label>
          <label className="block text-xs text-zinc-500">
            Слика (URL, по желба)
            <input className={input} value={image} onChange={(e) => setImage(e.target.value)} />
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              className={`${btn} bg-teal-600 text-white hover:bg-teal-700`}
              onClick={() =>
                run(
                  () =>
                    saveKvizcheQuestion(week.id, day, {
                      prompt,
                      options,
                      correct_index: timeline ? null : correct,
                      explanation,
                      image_url: image,
                    }),
                  "Зачувано.",
                )
              }
            >
              Зачувај
            </button>
            {q && (
              <button
                type="button"
                disabled={pending}
                className={`${btn} text-red-600 hover:bg-red-50`}
                onClick={() => {
                  if (confirm("Да се избрише прашањето и сите одговори на него?"))
                    run(() => deleteKvizcheQuestion(q.id), "Избришано.");
                }}
              >
                <Trash2 size={14} /> Избриши
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
