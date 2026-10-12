"use client";

import { Fragment, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  EVENT_CATEGORY_LABELS,
  type EventCategory,
} from "../../lib/data/events";

const CATEGORY_ENTRIES = Object.entries(EVENT_CATEGORY_LABELS) as [
  EventCategory,
  string,
][];

const STEPS = [
  { n: 1, label: "Настан" },
  { n: 2, label: "Слика" },
  { n: 3, label: "Контакт" },
] as const;

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

interface Props {
  /** Called from step 1's „Назад" — return to a chooser screen or close. */
  onCancel: () => void;
  /** Called after a successful submit (Затвори button). */
  onClose: () => void;
  userEmail?: string;
  userName?: string;
}

/**
 * Embedded 3-step "пријави настан" wizard. Renders the step indicator,
 * scrollable body and footer — but NO modal chrome, so it lives inside
 * SubmitEventModal's shell. Mirrors StoryForm (Позитива) with event fields.
 */
export default function EventSubmitForm({ onCancel, onClose, userEmail, userName }: Props) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — event details
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<EventCategory>("other");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 — media
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");

  // Step 3 — contact
  const [submitterName, setSubmitterName] = useState(userName ?? "");
  const [submitterEmail, setSubmitterEmail] = useState(userEmail ?? "");
  const [phone, setPhone] = useState("");
  const honeypotRef = useRef<HTMLInputElement>(null);

  function pickImage(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setImage(f);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  function removeImage() {
    setImage(null);
    setImagePreview(null);
  }

  function canAdvance() {
    if (step === 1) {
      return title.trim().length >= 3 && startDate.length > 0 && location.trim().length >= 2;
    }
    return true;
  }

  async function handleSubmit() {
    if (honeypotRef.current?.value) { setDone(true); return; }
    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("category", category);
      form.append("startDate", startDate);
      form.append("endDate", endDate);
      form.append("time", time);
      form.append("location", location);
      form.append("description", description);
      form.append("sourceUrl", sourceUrl);
      form.append("submitterName", submitterName);
      form.append("submitterEmail", submitterEmail);
      form.append("phone", phone);
      if (image) form.append("image", image);

      const res = await fetch("/api/events/submit", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Грешка при испраќање.");
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Непозната грешка.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success ───────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light">
          <Check size={28} className="text-primary" />
        </div>
        <h3 className="mt-4 text-base font-semibold text-zinc-900">Благодариме!</h3>
        <p className="mt-1 max-w-xs text-sm leading-relaxed text-zinc-500">
          Настанот е примен. Ќе го прегледаме и ако е соодветен, ќе го објавиме
          на страницата Случувања.
        </p>
        <button
          onClick={onClose}
          className="mt-5 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90">
          Затвори
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Honeypot */}
      <input
        ref={honeypotRef}
        name="website"
        type="text"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute opacity-0 pointer-events-none"
        autoComplete="off"
      />

      {/* Step indicator */}
      <div className="flex shrink-0 items-center border-b border-zinc-100 bg-white px-4 pb-3 pt-4 sm:px-5">
        {STEPS.map((s, i) => {
          const active = step === s.n;
          const completed = step > s.n;
          return (
            <Fragment key={s.n}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary text-white"
                    : completed
                      ? "bg-primary-light text-primary"
                      : "bg-zinc-100 text-zinc-400",
                )}>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold",
                    active ? "bg-white/20 text-white" : "bg-white text-zinc-500",
                  )}>
                  {completed ? <Check size={12} /> : s.n}
                </span>
                <span>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span className={cn("mx-2 h-px flex-1", completed ? "bg-primary" : "bg-zinc-200")} />
              )}
            </Fragment>
          );
        })}
      </div>

      {/* Body */}
      <div className="desktop-scrollbar-hidden min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
        {/* ── Step 1: Event details ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-end gap-2">
                <label className="text-xs font-medium text-zinc-700">Наслов на настанот</label>
                <span className="ml-auto text-[10px] text-zinc-400">{title.length} / 140</span>
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 140))}
                placeholder="пр. Концерт на градскиот плоштад"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">Категорија</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_ENTRIES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setCategory(value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      category === value
                        ? "border-primary bg-primary text-white"
                        : "border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300",
                    )}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Датум</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Крај <span className="font-normal text-zinc-400">(незадолж.)</span>
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Време <span className="font-normal text-zinc-400">(незадолж.)</span>
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Локација</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value.slice(0, 200))}
                  placeholder="пр. Градски парк, Прилеп"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-end gap-2">
                <label className="text-xs font-medium text-zinc-700">
                  Опис <span className="font-normal text-zinc-400">(незадолжително)</span>
                </label>
                <span className="ml-auto text-[10px] text-zinc-400">{description.length} / 2000</span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 2000))}
                placeholder="Што се случува? Кој настапува? Влез, цени, детали…"
                rows={5}
                className={cn(inputCls, "resize-none")}
              />
            </div>
          </div>
        )}

        {/* ── Step 2: Media ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-700">
                Насловна слика / постер <span className="font-normal text-zinc-400">(незадолжително)</span>
              </label>
              {imagePreview ? (
                <div className="group relative aspect-video w-full overflow-hidden rounded-lg bg-zinc-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                  <button
                    onClick={removeImage}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 py-8 hover:bg-zinc-50">
                  <ImagePlus size={22} className="text-zinc-400" />
                  <span className="text-xs text-zinc-500">Прикачи слика (до 8MB)</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => pickImage(e.target.files)} />
                </label>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Надворешен линк <span className="font-normal text-zinc-400">(незадолжително)</span>
              </label>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Facebook настан, билети…"
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* ── Step 3: Contact + preview ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-primary/15 bg-primary-light/50 px-3 py-2.5">
              <span className="mt-px shrink-0 text-sm">🤝</span>
              <p className="text-[11px] leading-relaxed text-zinc-600">
                Контактот се користи само ако имаме прашања за настанот —{" "}
                <strong className="text-zinc-800">нема да биде јавно прикажан.</strong>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Име</label>
                <input
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder="Вашето име"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">E-пошта</label>
                <input
                  type="email"
                  value={submitterEmail}
                  onChange={(e) => setSubmitterEmail(e.target.value)}
                  placeholder="vasa@email.com"
                  className={inputCls}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-700">
                Телефон <span className="font-normal text-zinc-400">(незадолжително)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07X XXX XXX"
                className={inputCls}
              />
            </div>

            <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                Преглед на настанот
              </p>
              <p className="line-clamp-1 text-sm font-semibold text-zinc-900">{title || "—"}</p>
              <p className="text-xs text-zinc-500">
                {[EVENT_CATEGORY_LABELS[category], startDate, time].filter(Boolean).join(" · ")}
              </p>
              {location && <p className="text-xs text-zinc-500">📍 {location}</p>}
              {imagePreview && <span className="text-[10px] text-zinc-400">📷 Слика прикачена</span>}
            </div>

            {error && (
              <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-100 bg-white px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((s) => s - 1) : onCancel())}
          disabled={submitting}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
          <ChevronLeft size={14} /> Назад
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={() => canAdvance() && setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">
            Продолжи <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Се испраќа…
              </>
            ) : (
              <>
                <Check size={14} /> Пријави настан
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
