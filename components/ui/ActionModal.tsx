"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  Check,
  ImagePlus,
  Lightbulb,
  MapPin,
  Megaphone,
  Newspaper,
  X,
} from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { compressImage } from "../../lib/compressImage";
import { getIssuePath } from "../../lib/utils";
import { useKeyboardInset } from "../../lib/hooks/useKeyboardInset";
import Button from "./Button";
import StreetAutocomplete from "../issues/StreetAutocomplete";
import DuplicateAlert, { type SimilarIssue } from "../issues/DuplicateAlert";
import NewInitiativeForm from "../initiatives/NewInitiativeForm";
import StoryForm from "../positive/StoryForm";
import EventSubmitForm from "../events/EventSubmitForm";
import { toast } from "sonner";

const LocationPickerModal = dynamic(
  () => import("../issues/LocationPickerModal"),
  { ssr: false },
);

// ── Constants ──────────────────────────────────────────────────────────────────
// Temporarily disable *posting* a problem report. The form stays fully openable
// and fillable (so people can see how it works) — only the final insert is
// blocked. Ideas, stories, memberships and donations are unaffected. Flip back
// to `true` to re-enable reporting.
const REPORTING_ENABLED = true;

const DISTRICTS = [
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
] as const;

const REPORT_CATEGORIES = [
  "road",
  "water",
  "power",
  "garbage",
  "park",
  "negligent",
  "transport",
  "parking",
  "admin",
  "other",
] as const;

const DISTRICT_MK: Record<string, string> = {
  Center: "Центар",
  Varoš: "Варош",
  Trizla: "Тризла",
  Točila: "Точила",
  Rid: "Рид",
  Tipski: "Типски",
  Boncejca: "Бончејца",
  KorzoMaalo: "Корзо Маало",
  MarinoMaalo: "Марино Маало",
  Cacorica: "Чачорица",
};

const CATEGORY_MK: Record<string, string> = {
  road: "Патишта",
  water: "Вода",
  power: "Осветлување",
  garbage: "Ѓубре",
  park: "Парк",
  negligent: "Несовесни граѓани",
  transport: "Градски превоз",
  parking: "Паркинзи",
  admin: "Јавна Администрација",
  other: "Друго",
};

// ── Schemas ────────────────────────────────────────────────────────────────────
const reportSchema = z.object({
  title: z.string().min(5, "Насловот мора да има барем 5 знаци"),
  description: z.string().optional(),
  street_name: z.string().optional(),
  district: z.enum(DISTRICTS, { error: "Изберете населба" }),
  category: z.enum(REPORT_CATEGORIES),
});
type ReportFields = z.infer<typeof reportSchema>;

// ── Component types ────────────────────────────────────────────────────────────
type Step = "choose" | "report" | "idea" | "story" | "event";

interface Props {
  userId?: string;
  userEmail?: string;
  userName?: string;
  agencyId?: string | null;
  onClose: () => void;
}

// ──────────────────────────────────────────────────────────────────────────────
export default function ActionModal({ userId, userEmail, userName, agencyId, onClose }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  // Extra bottom room so form fields clear the on-screen keyboard on mobile.
  const kbInset = useKeyboardInset();

  // ── Shell ─────────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("choose");
  const [open, setOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [swipeDy, setSwipeDy] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragHandleRef = useRef<HTMLDivElement>(null);

  // ── Report state ──────────────────────────────────────────────────────────────
  // Mode: "problem" = report something to be fixed (default); "solved" = a civic
  // action the citizen has ALREADY done (issue is born resolved, before+after).
  const [reportMode, setReportMode] = useState<"problem" | "solved">("problem");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  // "After" photo — only used in solved mode (the result of the action).
  const [reportAfterFile, setReportAfterFile] = useState<File | null>(null);
  const [reportAfterPreview, setReportAfterPreview] = useState<string | null>(null);
  const [reportStreetNum, setReportStreetNum] = useState("");
  const [reportPinLat, setReportPinLat] = useState<number | null>(null);
  const [reportPinLng, setReportPinLng] = useState<number | null>(null);
  const [similar, setSimilar] = useState<SimilarIssue[]>([]);
  const [dupDismissed, setDupDismissed] = useState(false);
  const reportFileRef = useRef<HTMLInputElement>(null);
  const reportAfterFileRef = useRef<HTMLInputElement>(null);

  // ── Location picker (report only) ───────────────────────────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false);

  // ── Breakpoint detection ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 640px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // ── Entrance animation ────────────────────────────────────────────────────────
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ── Animated close ────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setOpen(false);
    setSwipeDy(0);
    setTimeout(onClose, 280);
  }, [onClose]);

  // ── Drag-to-close (handle only) ───────────────────────────────────────────────
  useEffect(() => {
    const el = dragHandleRef.current;
    if (!el) return;
    let startY = 0;
    let dragging = false;
    let currentDy = 0;

    function onStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      dragging = false;
      currentDy = 0;
    }
    function onMove(e: TouchEvent) {
      const dy = e.touches[0].clientY - startY;
      if (!dragging && dy > 8) dragging = true;
      if (dragging) {
        e.preventDefault();
        currentDy = Math.max(0, dy);
        setSwipeDy(currentDy);
      }
    }
    function onEnd() {
      if (dragging && currentDy > 80) {
        handleClose();
      } else if (dragging) {
        setSwipeDy(0);
      }
      dragging = false;
      currentDy = 0;
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [handleClose]);

  // ── Escape key ────────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (step !== "choose") setStep("choose");
      else handleClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, handleClose]);

  // ── React Hook Form: Report ───────────────────────────────────────────────────
  const {
    register: rReg,
    handleSubmit: rSubmit,
    control: rCtrl,
    setValue: rSet,
    getValues: rGet,
    formState: { errors: rErr, isSubmitting: rBusy },
  } = useForm<ReportFields>({
    resolver: zodResolver(reportSchema),
    defaultValues: { category: "road" },
  });

  const watchedCategory = useWatch({ control: rCtrl, name: "category" });
  const watchedStreet = useWatch({ control: rCtrl, name: "street_name" });

  useEffect(() => {
    const street = (watchedStreet ?? "").trim();
    const hasPin = reportPinLat !== null && reportPinLng !== null;
    if (!watchedCategory || (street.length < 3 && !hasPin)) {
      const id = setTimeout(() => setSimilar([]), 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(async () => {
      const { data, error } = await supabase.rpc("find_similar_issues", {
        p_category: watchedCategory,
        p_street: street.length >= 3 ? street : null,
        p_lat: reportPinLat,
        p_lng: reportPinLng,
        p_radius_m: 200,
        p_limit: 5,
      });
      if (!error) {
        setSimilar((data ?? []) as SimilarIssue[]);
        setDupDismissed(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [watchedCategory, watchedStreet, reportPinLat, reportPinLng, supabase]);

  // Upload one file to issue-photos and return its public URL (or null on error).
  async function uploadIssuePhoto(original: File): Promise<string | null> {
    // Shrink before upload. The mobile app downloads these originals as-is
    // (no resizer in front of Storage), so an uncompressed web upload is billed
    // as egress against every phone that scrolls past it.
    const file = await compressImage(original);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage
      .from("issue-photos")
      // Unique + immutable filename → cache a year (the default 1h TTL was
      // forcing hourly re-downloads that dominated cached-egress).
      .upload(path, file, { contentType: file.type, cacheControl: "31536000" });
    if (error) return null;
    return supabase.storage.from("issue-photos").getPublicUrl(data.path).data.publicUrl;
  }

  // ── Report submit ─────────────────────────────────────────────────────────────
  async function onReportSubmit(values: ReportFields) {
    if (!REPORTING_ENABLED) {
      toast.info("Пријавувањето проблеми е привремено оневозможено. Наскоро повторно ќе биде достапно. 🙏");
      return;
    }

    if (!userId) {
      const next = `${location.pathname}${location.search}`;
      window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }

    const solved = reportMode === "solved";

    // A civic action needs both photos — the before and the result — to be
    // believable and to render the before/after view.
    if (solved && (!reportFile || !reportAfterFile)) {
      toast.error("Додај фотографија пред и потоа за да ја објавиш акцијата");
      return;
    }

    // Upload photos. Problem mode: single optional photo. Solved mode: the first
    // file is the "before" (photo_url), the second is the "after" (after_photo_url).
    let photoUrl: string | null = null;
    let afterPhotoUrl: string | null = null;
    if (reportFile) {
      photoUrl = await uploadIssuePhoto(reportFile);
      if (!photoUrl) {
        toast.error("Грешка при прикачување на фотографијата");
        return;
      }
    }
    if (solved && reportAfterFile) {
      afterPhotoUrl = await uploadIssuePhoto(reportAfterFile);
      if (!afterPhotoUrl) {
        toast.error("Грешка при прикачување на фотографијата „потоа“");
        return;
      }
    }

    const base = values.street_name?.trim() || null;
    const num = reportStreetNum.trim();
    const { data: created, error } = await supabase
      .from("issues")
      .insert({
        ...values,
        street_name: base && num ? `${base} ${num}` : base,
        reported_by: userId,
        photo_url: photoUrl,
        lat: reportPinLat,
        lng: reportPinLng,
        // Solved mode is born resolved and credits the citizen as the resolver,
        // which triggers the gentle agency/neighbour notifications (see
        // add_citizen_resolved_action.sql).
        ...(solved && {
          status: "resolved",
          resolved_by: userId,
          after_photo_url: afterPhotoUrl,
        }),
      })
      .select("id, title")
      .single();
    if (error || !created) {
      toast.error(error?.message ?? "Не успеа да се зачува. Обиди се повторно.");
      return;
    }
    toast.success(solved ? "Акцијата е објавена! 👏" : "Проблемот е пријавен!");
    handleClose();
    // Take the user straight to their new post so they see it right away.
    router.push(getIssuePath(created.id, created.title));
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const atForm =
    step === "report" || step === "idea" || step === "story" || step === "event";
  const headerTitle =
    step === "report"
      ? "Пријави проблем"
      : step === "idea"
        ? "Нова идеја"
        : step === "story"
          ? "Сподели приказна"
          : step === "event"
            ? "Пријави настан"
            : "Учествувај";

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 transition-opacity duration-500"
        style={{ opacity: open ? 1 : 0 }}
        onClick={handleClose}
      />

      {/* Positioner */}
      <div className="pointer-events-none  fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
        <div
          ref={drawerRef}
          className={`pointer-events-auto flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:max-w-xl sm:rounded-2xl lg:max-w-3xl${swipeDy === 0 ? " transition-[transform,opacity] duration-500 ease-out" : ""}`}
          style={{
            transform: isDesktop
              ? open
                ? "translateY(0)"
                : "translateY(-42px)"
              : open
                ? `translateY(${swipeDy}px)`
                : "translateY(110%)",
            opacity: isDesktop ? (open ? 1 : 0) : 1,
            // Fixed height so the modal stays the same size across steps
            height: "85dvh",
            maxHeight: "95dvh",
            // Round top corners on mobile (bottom sheet)
            borderRadius: isDesktop ? undefined : "1rem 1rem 0 0",
          }}>
          {/* ── Drag handle — mobile only ── */}
          <div
            ref={dragHandleRef}
            className="flex shrink-0 cursor-grab touch-none justify-center pb-2 pt-3 active:cursor-grabbing sm:hidden">
            <div className="pointer-events-none h-1.5 w-12 rounded-full bg-zinc-300" />
          </div>

          {/* ── Sticky header ── */}
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
            <div className="flex items-center gap-2">
              {atForm ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep("choose")}
                    aria-label="Назад"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200">
                    <ArrowLeft size={16} />
                  </button>
                  <h2 className="text-base font-semibold">{headerTitle}</h2>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo/logo-black.svg"
                    alt="Мој Прилеп"
                    className="h-7 w-7"
                  />
                  <div className="flex items-baseline gap-1 text-lg leading-none tracking-tight">
                    <span className="font-semibold text-slate-900">Мој</span>
                    <span className="font-semibold text-primary">Прилеп</span>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Затвори"
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200">
              <X size={18} />
            </button>
          </div>

          {/* ── Step slider ── */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <div
              className="flex h-full"
              style={{
                width: "200%",
                transform: atForm ? "translateX(-50%)" : "translateX(0%)",
                transition: "transform 320ms cubic-bezier(0.4, 0, 0.2, 1)",
              }}>
              {/* ══ Panel 0: Chooser ══ */}
              <div className="desktop-scrollbar-hidden w-1/2 overflow-y-auto">
                {/* Compact rows (icon left, text right). Single column on
                    mobile, 2×2 grid on large screens. */}
                <div className="flex min-h-full flex-col p-4 sm:p-5">
                  {/* Citizen actions — hidden for institution operator accounts,
                      which only broadcast official posts. */}
                  {!agencyId && (
                    <div className="grid flex-1 auto-rows-fr grid-cols-1 gap-2.5 sm:gap-3 lg:grid-cols-2">
                  {/* Report Problem */}
                  <button
                    type="button"
                    onClick={() => setStep("report")}
                    className="group flex h-full w-full items-center gap-3.5 rounded-2xl bg-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-200 active:scale-[0.99]">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <AlertTriangle size={24} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-zinc-900">
                        Пријави Проблем
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-zinc-500">
                        Дупка, расипана светилка, нечистотии и слично.
                      </p>
                    </div>
                  </button>

                  {/* Share Idea */}
                  <button
                    type="button"
                    onClick={() => setStep("idea")}
                    className="group flex h-full w-full items-center gap-3.5 rounded-2xl bg-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-200 active:scale-[0.99]">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Lightbulb size={24} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-zinc-900">
                        Кажи си ја Идејата
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-zinc-500">
                        Парк, патека, настан или нешто друго за Прилеп.
                      </p>
                    </div>
                  </button>

                  {/* Report Event */}
                  <button
                    type="button"
                    onClick={() => setStep("event")}
                    className="group flex h-full w-full items-center gap-3.5 rounded-2xl bg-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-200 active:scale-[0.99]">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <CalendarPlus size={24} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-zinc-900">
                        Пријави Настан
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-zinc-500">
                        Концерт, фестивал, спорт или друго случување.
                      </p>
                    </div>
                  </button>

                  {/* Share Story */}
                  <button
                    type="button"
                    onClick={() => setStep("story")}
                    className="group flex h-full w-full items-center gap-3.5 rounded-2xl bg-zinc-100 px-4 py-3 text-left transition-colors hover:bg-zinc-200 active:scale-[0.99]">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                      <Newspaper size={24} className="text-zinc-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-base font-bold text-zinc-900">
                        Сподели Приказна
                      </p>
                      <p className="mt-0.5 text-sm leading-snug text-zinc-500">
                        Добра вест, успех или нешто убаво од Прилеп.
                      </p>
                    </div>
                  </button>
                    </div>
                  )}

                  {/* Agency alert — only for institution operator accounts */}
                  {agencyId && (
                    <button
                      type="button"
                      onClick={() => {
                        router.push(`/agency/${agencyId}`);
                        handleClose();
                      }}
                      className="group flex w-full flex-1 items-center gap-4 rounded-2xl bg-primary/10 p-4 text-left transition-colors hover:bg-primary/20 active:scale-[0.99]">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                        <Megaphone size={26} className="text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-base font-bold text-zinc-900">
                          Соопштение / Алармирање
                        </p>
                        <p className="mt-0.5 text-sm leading-snug text-zinc-500">
                          Објави известување за улица, населба или сите граѓани.
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              {/* ══ Panel 1: Forms ══ */}
              <div
                className="desktop-scrollbar-hidden w-1/2 overflow-y-auto"
                style={kbInset ? { paddingBottom: kbInset } : undefined}>
                {/* ── Report form ── */}
                <div className={step === "report" ? "block" : "hidden"}>
                  <form
                    onSubmit={rSubmit(onReportSubmit)}
                    className="space-y-2 p-4 sm:p-5">
                    {/* Mode toggle: report a problem vs. share an action you've
                        already done yourself. */}
                    <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1">
                      <button
                        type="button"
                        onClick={() => setReportMode("problem")}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          reportMode === "problem"
                            ? "bg-white text-teal-700 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-700"
                        }`}>
                        Пријавувам проблем
                      </button>
                      <button
                        type="button"
                        onClick={() => setReportMode("solved")}
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                          reportMode === "solved"
                            ? "bg-white text-teal-700 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-700"
                        }`}>
                        Јас веќе го решив 👏
                      </button>
                    </div>
                    {reportMode === "solved" && (
                      <p className="-mt-1 text-[11px] leading-snug text-zinc-500">
                        Сподели нешто што ти самиот го реши за твоето маало. Ќе се
                        објави како решено и ќе ја извести надлежната служба.
                      </p>
                    )}

                    <div>
                      <label className="text-sm font-medium text-zinc-700">
                        Наслов *
                      </label>
                      <input
                        {...rReg("title")}
                        placeholder={
                          reportMode === "solved"
                            ? "пр. Искосив трева во паркот"
                            : "Кратко опишете го проблемот"
                        }
                        className="mt-1.5 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500"
                      />
                      {rErr.title && (
                        <p className="mt-1 text-[11px] text-red-500">
                          {rErr.title.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="text-sm font-medium text-zinc-700">
                        Опис
                      </label>
                      <textarea
                        {...rReg("description")}
                        rows={3}
                        placeholder="Додајте повеќе детали…"
                        className="mt-1.5 w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-teal-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-zinc-700">
                        Улица / локација
                      </label>
                      <div className="mt-1.5 flex items-stretch gap-2">
                        <div className="min-w-0 flex-1">
                          <Controller
                            name="street_name"
                            control={rCtrl}
                            render={({ field }) => (
                              <StreetAutocomplete
                                value={field.value ?? ""}
                                onChange={field.onChange}
                                placeholder="пр. Партизанска"
                                inputClassName="w-full rounded-xl border border-zinc-200 pl-10 pr-4 py-3 text-sm outline-none transition-colors focus:border-teal-500"
                                onSelect={(s) => {
                                  if (s.district)
                                    rSet("district", s.district, {
                                      shouldDirty: true,
                                    });
                                }}
                              />
                            )}
                          />
                        </div>
                        <input
                          value={reportStreetNum}
                          onChange={(e) =>
                            setReportStreetNum(
                              e.target.value.replace(/[^\d\w/]/g, ""),
                            )
                          }
                          placeholder="Бр."
                          maxLength={8}
                          className="w-14 shrink-0 rounded-xl border border-zinc-200 px-2 text-center text-sm outline-none transition-colors focus:border-teal-500"
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <p className="text-[10px] leading-snug text-zinc-400">
                          Не ја знаете точната адреса?
                        </p>
                        <button
                          type="button"
                          onClick={() => setPickerOpen(true)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                            reportPinLat !== null
                              ? "border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100"
                              : "border-zinc-200 bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700"
                          }`}>
                          {reportPinLat !== null ? (
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

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium text-zinc-700">
                          Населба *
                        </label>
                        <select
                          {...rReg("district")}
                          defaultValue=""
                          className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500">
                          <option value="" disabled>
                            — Изберете —
                          </option>
                          {DISTRICTS.map((d) => (
                            <option key={d} value={d}>
                              {DISTRICT_MK[d]}
                            </option>
                          ))}
                        </select>
                        {rErr.district && (
                          <p className="mt-1 text-[11px] text-red-500">
                            {rErr.district.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-sm font-medium text-zinc-700">
                          Категорија *
                        </label>
                        <select
                          {...rReg("category")}
                          className="mt-1.5 w-full cursor-pointer rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-teal-500">
                          {REPORT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {CATEGORY_MK[c]}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={reportMode === "solved" ? "grid gap-3 lg:grid-cols-2" : ""}>
                    <div>
                      <label className="text-sm font-medium text-zinc-700">
                        {reportMode === "solved" ? (
                          <>
                            Слика пред <span className="text-red-500">*</span>
                          </>
                        ) : (
                          <>
                            Фотографија{" "}
                            <span className="text-zinc-400">(незадолжително)</span>
                          </>
                        )}
                      </label>
                      <input
                        ref={reportFileRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) {
                            toast.error(
                              "Форматот не е поддржан. Ве молиме користете JPG, PNG или WebP (не HEIC).",
                            );
                            e.target.value = "";
                            return;
                          }
                          setReportFile(f);
                          setReportPreview(URL.createObjectURL(f));
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => reportFileRef.current?.click()}
                        className="relative mt-1.5 flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 px-4 text-sm text-zinc-500 transition-colors hover:border-teal-400 hover:bg-teal-50/40 hover:text-teal-600">
                        {reportPreview ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={reportPreview}
                              alt="Преглед"
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                            <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-[11px] text-white">
                              {reportFile?.name}
                            </span>
                          </>
                        ) : (
                          <>
                            <ImagePlus size={28} className="text-zinc-400" />
                            <span>Кликнете за да додадете фотографија</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* "After" photo — solved mode only */}
                    {reportMode === "solved" && (
                      <div>
                        <label className="text-sm font-medium text-zinc-700">
                          Слика потоа <span className="text-red-500">*</span>
                        </label>
                        <input
                          ref={reportAfterFileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            if (!/^image\/(jpeg|png|webp)$/i.test(f.type)) {
                              toast.error(
                                "Форматот не е поддржан. Ве молиме користете JPG, PNG или WebP (не HEIC).",
                              );
                              e.target.value = "";
                              return;
                            }
                            setReportAfterFile(f);
                            setReportAfterPreview(URL.createObjectURL(f));
                          }}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => reportAfterFileRef.current?.click()}
                          className="relative mt-1.5 flex h-44 w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-zinc-300 px-4 text-sm text-zinc-500 transition-colors hover:border-teal-400 hover:bg-teal-50/40 hover:text-teal-600">
                          {reportAfterPreview ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={reportAfterPreview}
                                alt="Преглед"
                                className="absolute inset-0 h-full w-full object-cover"
                              />
                              <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-2 py-1 text-left text-[11px] text-white">
                                {reportAfterFile?.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <ImagePlus size={28} className="text-zinc-400" />
                              <span>Кликнете за да додадете фотографија</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    </div>

                    {reportMode !== "solved" && !dupDismissed && similar.length > 0 && (
                      <DuplicateAlert
                        similar={similar}
                        onDismiss={() => setDupDismissed(true)}
                      />
                    )}

                    {!REPORTING_ENABLED && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-snug text-amber-800">
                        ℹ️ Пријавувањето проблеми е привремено оневозможено. Можете да ја разгледате формата, но сè уште не може да се објави. Наскоро повторно ќе биде достапно.
                      </div>
                    )}

                    <div className="sticky bottom-0 z-10 -mx-4 flex justify-end gap-3 border-t border-zinc-100 bg-white/95 px-4 pb-1 pt-3 backdrop-blur sm:-mx-5 sm:px-5">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleClose}
                        className="px-6 py-3 text-base">
                        Откажи
                      </Button>
                      <Button
                        type="submit"
                        variant="teal"
                        disabled={rBusy}
                        className="px-8 py-3 text-base">
                        {rBusy
                          ? "Се испраќа…"
                          : reportMode === "solved"
                            ? "Објави акција"
                            : "Пријави"}
                      </Button>
                    </div>
                  </form>
                </div>

                {/* ── Idea wizard (creates an initiative at stage „idea“) ── */}
                <div className={step === "idea" ? "h-full" : "hidden"}>
                  <NewInitiativeForm
                    embedded
                    onCancel={() => setStep("choose")}
                    onSuccess={() => {
                      router.push("/initiatives?stage=idea");
                      handleClose();
                    }}
                  />
                </div>

                {/* ── Story wizard (creates a Позитива draft in Sanity) ── */}
                <div className={step === "story" ? "h-full" : "hidden"}>
                  <StoryForm
                    onCancel={() => setStep("choose")}
                    onClose={handleClose}
                    userEmail={userEmail}
                    userName={userName}
                  />
                </div>

                {/* ── Event wizard (creates a cityEvent draft in Sanity) ── */}
                <div className={step === "event" ? "h-full" : "hidden"}>
                  <EventSubmitForm
                    onCancel={() => setStep("choose")}
                    onClose={handleClose}
                    userEmail={userEmail}
                    userName={userName}
                  />
                </div>
              </div>
              {/* end panels track */}
            </div>
          </div>
          {/* end slider */}
        </div>
      </div>

      {/* ── Location picker (report) ── */}
      {pickerOpen && (
        <LocationPickerModal
          initialLat={reportPinLat}
          initialLng={reportPinLng}
          onClose={() => setPickerOpen(false)}
          onConfirm={(lat, lng, streetOnly, matched, houseNumber) => {
            setReportPinLat(lat);
            setReportPinLng(lng);
            if (streetOnly) {
              const cur = (rGet("street_name") ?? "").trim();
              if (!cur) rSet("street_name", streetOnly, { shouldDirty: true });
            }
            if (houseNumber) setReportStreetNum(houseNumber);
            if (matched?.district)
              rSet("district", matched.district, { shouldDirty: true });
            toast.success(
              streetOnly
                ? `Локацијата е зачувана: ${streetOnly}${houseNumber ? " " + houseNumber : ""}`
                : "Локацијата е зачувана",
            );
            setPickerOpen(false);
          }}
        />
      )}
    </>
  );
}
