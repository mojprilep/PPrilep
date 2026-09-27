"use client";

import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  X,
  Upload,
  ChevronRight,
  ChevronLeft,
  Check,
  Users,
  MapPin,
} from "lucide-react";
import {
  createInitiative,
  updateInitiative,
} from "../../app/actions/initiatives";
import { createClient } from "../../lib/supabase/client";
import { compressImage } from "../../lib/compressImage";
import { CATEGORY_LABELS_INIT } from "../../lib/initiatives";
import { DISTRICT_LABELS, cn } from "../../lib/utils";
import StreetAutocomplete from "../issues/StreetAutocomplete";
import type {
  InitiativeCategory,
  District,
  Initiative,
} from "../../lib/types/database";

const LocationPickerModal = dynamic(
  () => import("../issues/LocationPickerModal"),
  { ssr: false },
);

const DISTRICTS: District[] = [
  "Center",
  "Varoš",
  "Trizla",
  "Točila",
  "Rid",
  "Tipski",
  "Boncejca",
  "KorzoMaalo",
  "MarinoMaalo",
  "Cacorica",
];

const CATEGORIES = Object.keys(CATEGORY_LABELS_INIT) as InitiativeCategory[];

const STEPS = [
  { n: 1, label: "Основни" },
  { n: 2, label: "Детали" },
  { n: 3, label: "Преглед" },
] as const;

interface State {
  title: string;
  description: string;
  category: InitiativeCategory | "";
  district: District | "";
  street_name: string;
  street_number: string;
  lat: number | null;
  lng: number | null;
  cover_image: File | null;
  cover_preview: string | null;
  /** Already-uploaded cover URL (edit mode), kept unless replaced/removed. */
  cover_url: string | null;
  problem_statement: string;
  expected_impact: string;
  open_funding: boolean;
  target_amount: string;
  funding_deadline: string;
}

const EMPTY: State = {
  title: "",
  description: "",
  category: "",
  district: "",
  street_name: "",
  street_number: "",
  lat: null,
  lng: null,
  cover_image: null,
  cover_preview: null,
  cover_url: null,
  problem_statement: "",
  expected_impact: "",
  open_funding: false,
  target_amount: "",
  funding_deadline: "",
};

function initiativeToState(i: Initiative): State {
  return {
    title: i.title,
    description: i.description,
    category: i.category,
    district: i.district ?? "",
    street_name: i.street_name ?? "",
    street_number: "",
    lat: i.lat ?? null,
    lng: i.lng ?? null,
    cover_image: null,
    cover_preview: i.cover_image_url ?? null,
    cover_url: i.cover_image_url ?? null,
    problem_statement: i.problem_statement ?? "",
    expected_impact: i.expected_impact ?? "",
    open_funding: i.target_amount != null,
    target_amount: i.target_amount != null ? String(i.target_amount) : "",
    funding_deadline: i.funding_deadline ? i.funding_deadline.slice(0, 10) : "",
  };
}

interface NewInitiativeFormProps {
  /** Render without the page-style card chrome (for use inside a modal). */
  embedded?: boolean;
  /** Called from step 1's left action — e.g. return to a chooser screen. */
  onCancel?: () => void;
  /** Called on successful submit instead of the default route push. */
  onSuccess?: (id: string) => void;
  /** When provided, the form edits this initiative instead of creating one. */
  initiative?: Initiative;
}

export default function NewInitiativeForm({
  embedded = false,
  onCancel,
  onSuccess,
  initiative,
}: NewInitiativeFormProps = {}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isEdit = !!initiative;
  const [step, setStep] = useState(1);
  const [state, setState] = useState<State>(
    initiative ? initiativeToState(initiative) : EMPTY,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof State>(key: K, value: State[K]) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function pickImage(file: File | null) {
    if (state.cover_preview) URL.revokeObjectURL(state.cover_preview);
    if (!file) {
      setState((s) => ({
        ...s,
        cover_image: null,
        cover_preview: null,
        cover_url: null,
      }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Сликата е поголема од 5MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setState((s) => ({ ...s, cover_image: file, cover_preview: url }));
  }

  // ── Step validation ───────────────────────────────────────────────
  function validateStep1(): boolean {
    const e: Record<string, string> = {};
    if (state.title.trim().length < 10) e.title = "Минимум 10 знаци";
    else if (state.title.trim().length > 120) e.title = "Максимум 120 знаци";
    if (state.description.trim().length < 20)
      e.description = "Минимум 20 знаци";
    else if (state.description.trim().length > 2000)
      e.description = "Максимум 2000 знаци";
    if (!state.category) e.category = "Изберете категорија";
    if (!state.district) e.district = "Изберете населба";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {};
    if (state.problem_statement.length > 500)
      e.problem_statement = "Максимум 500 знаци";
    if (state.expected_impact.length > 500)
      e.expected_impact = "Максимум 500 знаци";
    if (state.open_funding) {
      const n = Number(state.target_amount);
      if (!state.target_amount || isNaN(n) || n <= 0)
        e.target_amount = "Внесете позитивен износ";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => Math.min(3, s + 1));
  }

  function back() {
    setErrors({});
    setStep((s) => Math.max(1, s - 1));
  }

  function submit() {
    if (!validateStep1() || !validateStep2()) {
      setStep(
        Object.keys(errors).some((k) =>
          ["title", "description", "category"].includes(k),
        )
          ? 1
          : 2,
      );
      return;
    }

    startTransition(async () => {
      // 1) Client-side image upload (avoids server action body limits).
      //    In edit mode, keep the existing cover unless a new file is chosen.
      let coverUrl: string | null = state.cover_url;
      if (state.cover_image) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Сесијата истече, најавете се повторно");
          router.push("/auth/login?next=/initiatives/new");
          return;
        }
        const cover = await compressImage(state.cover_image);
        const ext = cover.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("initiative-images")
          .upload(path, cover, {
            contentType: cover.type,
            cacheControl: "31536000",
            upsert: false,
          });
        if (upErr) {
          toast.error(`Грешка при прикачување слика: ${upErr.message}`);
          return;
        }
        coverUrl = supabase.storage.from("initiative-images").getPublicUrl(path)
          .data.publicUrl;
      }

      // 2) Submit text fields + uploaded URL via FormData
      const fd = new FormData();
      fd.set("title", state.title.trim());
      fd.set("description", state.description.trim());
      fd.set("category", state.category);
      if (state.district) fd.set("district", state.district);
      const streetBase = state.street_name.trim();
      const streetNum = state.street_number.trim();
      const fullStreet =
        streetBase && streetNum ? `${streetBase} ${streetNum}` : streetBase;
      if (fullStreet) fd.set("street_name", fullStreet);
      if (state.lat !== null) fd.set("lat", String(state.lat));
      if (state.lng !== null) fd.set("lng", String(state.lng));
      if (state.problem_statement.trim())
        fd.set("problem_statement", state.problem_statement.trim());
      if (state.expected_impact.trim())
        fd.set("expected_impact", state.expected_impact.trim());
      if (state.open_funding && state.target_amount) {
        fd.set("target_amount", state.target_amount);
        if (state.funding_deadline) {
          fd.set(
            "funding_deadline",
            new Date(state.funding_deadline).toISOString(),
          );
        }
      }
      if (coverUrl) fd.set("cover_image_url", coverUrl);

      const res = initiative
        ? await updateInitiative(initiative.id, fd)
        : await createInitiative(fd);
      if (!res.success) {
        toast.error(res.error);
        if (res.fieldErrors) {
          const e: Record<string, string> = {};
          for (const [k, msgs] of Object.entries(res.fieldErrors)) {
            if (msgs?.[0]) e[k] = msgs[0];
          }
          setErrors(e);
        }
        return;
      }
      toast.success(
        isEdit ? "Промените се зачувани!" : "Иницијативата е поднесена!",
      );
      if (onSuccess) {
        onSuccess(res.id);
        return;
      }
      router.push(isEdit ? "/initiatives" : "/initiatives?stage=idea");
      router.refresh();
    });
  }

  return (
    <div className={cn(embedded ? "flex h-full flex-col" : "space-y-5")}>
      {/* Step indicator — rectangles with connector lines, left / center / right */}
      <div
        className={cn(
          "flex items-center",
          embedded &&
            "shrink-0 bg-white px-4 sm:px-5 pt-4 pb-3 border-b border-zinc-100",
        )}>
        {STEPS.map((s, i) => {
          const active = step === s.n;
          const done = step > s.n;
          return (
            <Fragment key={s.n}>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                  active
                    ? "bg-slate-900 text-white"
                    : done
                      ? "bg-slate-100 text-slate-700"
                      : "bg-zinc-100 text-zinc-400",
                )}>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-white text-zinc-500",
                  )}>
                  {done ? <Check size={12} /> : s.n}
                </span>
                <span>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px flex-1 mx-2",
                    done ? "bg-slate-900" : "bg-zinc-200",
                  )}
                />
              )}
            </Fragment>
          );
        })}
      </div>

      <div
        className={cn(
          embedded
            ? "desktop-scrollbar-hidden flex-1 min-h-0 overflow-y-auto px-4 sm:px-5 py-4 space-y-4"
            : "bg-white border border-zinc-200 rounded-xl p-4 space-y-4",
        )}>
        {step === 1 && (
          <Step1
            state={state}
            errors={errors}
            set={set}
            pickImage={pickImage}
            onOpenPicker={() => setPickerOpen(true)}
          />
        )}
        {step === 2 && <Step2 state={state} errors={errors} set={set} />}
        {step === 3 && <Step3 state={state} />}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-2",
          embedded &&
            "shrink-0 bg-white px-4 sm:px-5 py-3 border-t border-zinc-100",
        )}>
        {step > 1 ? (
          <button
            type="button"
            onClick={back}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-theme-muted hover:bg-zinc-50 hover:text-theme-ink">
            <ChevronLeft size={14} /> Назад
          </button>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-theme-muted hover:bg-zinc-50 hover:text-theme-ink">
            <ChevronLeft size={14} /> Назад
          </button>
        ) : (
          <span />
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={next}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Продолжи <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {pending
              ? "Се зачувува…"
              : isEdit
                ? "Зачувај промени"
                : "Поднеси иницијатива"}
          </button>
        )}
      </div>

      {/* Location picker — same flow as „Пријави проблем“ */}
      {pickerOpen && (
        <LocationPickerModal
          initialLat={state.lat}
          initialLng={state.lng}
          onClose={() => setPickerOpen(false)}
          onConfirm={(lat, lng, streetOnly, matched, houseNumber) => {
            setState((s) => ({
              ...s,
              lat,
              lng,
              street_name:
                streetOnly && !s.street_name.trim()
                  ? streetOnly
                  : s.street_name,
              street_number: houseNumber ? houseNumber : s.street_number,
              district: matched?.district ? matched.district : s.district,
            }));
            setPickerOpen(false);
            toast.success(
              streetOnly
                ? `Локацијата е зачувана: ${streetOnly}${houseNumber ? " " + houseNumber : ""}`
                : "Локацијата е зачувана",
            );
          }}
        />
      )}
    </div>
  );
}

// ── Steps ──────────────────────────────────────────────────────────

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-[11px] text-red-600 mt-1">{msg}</p>;
}

function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className="text-[10px] text-theme-subtle ml-auto">
      {value.length} / {max}
    </span>
  );
}

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-xs font-medium text-theme-ink mb-1">
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10";

function Step1({
  state,
  errors,
  set,
  pickImage,
  onOpenPicker,
}: {
  state: State;
  errors: Record<string, string>;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
  pickImage: (f: File | null) => void;
  onOpenPicker: () => void;
}) {
  return (
    <>
      <div>
        <div className="flex items-end gap-2">
          <Label htmlFor="title">Наслов</Label>
          <CharCount value={state.title} max={120} />
        </div>
        <input
          id="title"
          className={inputCls}
          value={state.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Кратко и јасно"
        />
        <FieldError msg={errors.title} />
      </div>

      <div>
        <div className="flex items-end gap-2">
          <Label htmlFor="description">Опис</Label>
          <CharCount value={state.description} max={2000} />
        </div>
        <textarea
          id="description"
          rows={5}
          className={inputCls}
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Опишете ја идејата детално…"
        />
        <FieldError msg={errors.description} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="category">Категорија</Label>
          <select
            id="category"
            className={inputCls}
            value={state.category}
            onChange={(e) =>
              set("category", e.target.value as InitiativeCategory)
            }>
            <option value="">— Избери —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS_INIT[c]}
              </option>
            ))}
          </select>
          <FieldError msg={errors.category} />
        </div>
        <div>
          <Label htmlFor="district">Населба *</Label>
          <select
            id="district"
            className={inputCls}
            value={state.district}
            onChange={(e) => set("district", e.target.value as District)}>
            <option value="" disabled>
              — Изберете —
            </option>
            {DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {DISTRICT_LABELS[d] ?? d}
              </option>
            ))}
          </select>
          <FieldError msg={errors.district} />
        </div>
      </div>

      <div>
        <Label htmlFor="street">Улица / локација (опционално)</Label>
        <div className="flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <StreetAutocomplete
              value={state.street_name}
              onChange={(v) => set("street_name", v)}
              placeholder="пр. Партизанска"
              onSelect={(s) => {
                if (s.district) set("district", s.district);
              }}
            />
          </div>
          <input
            value={state.street_number}
            onChange={(e) =>
              set("street_number", e.target.value.replace(/[^\d\w/]/g, ""))
            }
            placeholder="Бр."
            maxLength={8}
            className="w-14 shrink-0 rounded-lg border border-zinc-200 px-2 text-center text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[10px] leading-snug text-theme-subtle">
            Не ја знаете точната адреса?
          </p>
          <button
            type="button"
            onClick={onOpenPicker}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors",
              state.lat !== null
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-zinc-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700",
            )}>
            {state.lat !== null ? (
              <>
                <Check size={11} /> Локацијата е поставена
              </>
            ) : (
              <>
                <MapPin size={11} /> Обележи на мапа
              </>
            )}
          </button>
        </div>
      </div>

      <div>
        <Label>Слика на насловница</Label>
        {state.cover_preview ? (
          <div className="relative w-full h-40 rounded-lg overflow-hidden bg-zinc-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.cover_preview}
              alt=""
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => pickImage(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1">
              <X size={14} />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-1 border-2 border-dashed border-zinc-300 rounded-lg py-6 cursor-pointer hover:bg-zinc-50">
            <Upload size={18} className="text-theme-muted" />
            <span className="text-xs text-theme-muted">
              Прикачи слика (до 5MB)
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>
    </>
  );
}

function Step2({
  state,
  errors,
  set,
}: {
  state: State;
  errors: Record<string, string>;
  set: <K extends keyof State>(k: K, v: State[K]) => void;
}) {
  return (
    <>
      <div className="flex items-start gap-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
        <Users size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p className="text-[11px] leading-relaxed text-theme-muted">
          Потребни се <strong className="text-theme-ink">100 поддршки</strong>{" "}
          за идејата да премине на гласање. Граѓаните гласаат откако ќе ја
          објавите.
        </p>
      </div>

      <div>
        <div className="flex items-end gap-2">
          <Label htmlFor="problem">Кој проблем го решава?</Label>
          <CharCount value={state.problem_statement} max={500} />
        </div>
        <textarea
          id="problem"
          rows={3}
          className={inputCls}
          value={state.problem_statement}
          onChange={(e) => set("problem_statement", e.target.value)}
        />
        <FieldError msg={errors.problem_statement} />
      </div>

      <div>
        <div className="flex items-end gap-2">
          <Label htmlFor="impact">Очекуван ефект</Label>
          <CharCount value={state.expected_impact} max={500} />
        </div>
        <textarea
          id="impact"
          rows={3}
          className={inputCls}
          value={state.expected_impact}
          onChange={(e) => set("expected_impact", e.target.value)}
        />
        <FieldError msg={errors.expected_impact} />
      </div>

      <label className="flex items-start gap-2 cursor-pointer pt-2">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={state.open_funding}
          onChange={(e) => set("open_funding", e.target.checked)}
        />
        <span className="text-sm text-theme-ink">
          Сакам да отворам фонд кампања кога ќе се достигне прагот
        </span>
      </label>

      {state.open_funding && (
        <div className="grid grid-cols-2 gap-3 pl-6">
          <div>
            <Label htmlFor="target">Цел за финансирање (ден.)</Label>
            <input
              id="target"
              type="number"
              min={1}
              className={inputCls}
              value={state.target_amount}
              onChange={(e) => set("target_amount", e.target.value)}
            />
            <FieldError msg={errors.target_amount} />
          </div>
          <div>
            <Label htmlFor="deadline">Рок за финансирање</Label>
            <input
              id="deadline"
              type="date"
              className={inputCls}
              value={state.funding_deadline}
              onChange={(e) => set("funding_deadline", e.target.value)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function Step3({ state }: { state: State }) {
  const items: { label: string; value: string }[] = [
    { label: "Наслов", value: state.title || "—" },
    {
      label: "Категорија",
      value: state.category
        ? CATEGORY_LABELS_INIT[state.category as InitiativeCategory]
        : "—",
    },
    {
      label: "Населба",
      value: state.district
        ? (DISTRICT_LABELS[state.district] ?? state.district)
        : "—",
    },
    { label: "Улица", value: state.street_name || "—" },
    { label: "Опис", value: state.description },
    { label: "Проблем", value: state.problem_statement || "—" },
    { label: "Ефект", value: state.expected_impact || "—" },
  ];

  if (state.open_funding) {
    items.push(
      { label: "Цел (ден.)", value: state.target_amount || "—" },
      { label: "Рок", value: state.funding_deadline || "—" },
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-theme-ink">Преглед</h3>
      {state.cover_preview && (
        <div className="relative w-full h-40 rounded-lg overflow-hidden bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={state.cover_preview}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <dl className="grid grid-cols-1 sm:grid-cols-[140px,1fr] gap-y-2 gap-x-3 text-sm">
        {items.map((it) => (
          <div key={it.label} className="contents">
            <dt className="text-xs text-theme-muted">{it.label}</dt>
            <dd className="text-theme-ink whitespace-pre-wrap wrap-break-word">
              {it.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
