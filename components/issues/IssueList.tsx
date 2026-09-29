"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useIssues } from "../../lib/hooks/useIssues";
import { useAuth } from "../../lib/hooks/useAuth";
import { useKeyboardInset } from "../../lib/hooks/useKeyboardInset";
import IssueCard from "./IssueCard";
import IssueCardSkeleton from "./IssueCardSkeleton";
import IssueDetail from "./IssueDetail";
import DateOffersPanel from "./DateOffersPanel";
import FilterSelect from "../ui/FilterSelect";
import ImageLightbox from "../ui/ImageLightbox";
import BeforeAfterSlider from "../ui/BeforeAfterSlider";
import { Filter } from "lucide-react";
import {
  DISTRICT_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  cdnUrl,
} from "../../lib/utils";
import type {
  District,
  Category,
  IssueStatus,
  Issue,
} from "../../lib/types/database";

const CATEGORY_ALL_LABEL_SHORT = "Категории";
const STATUS_ALL_LABEL_SHORT = "Статуси";

const DISTRICTS: Array<District | "all"> = [
  "all",
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
const CATEGORIES: Array<Category | "all"> = [
  "all",
  "road",
  "water",
  "power",
  "garbage",
  "park",
  "negligent",
  "transport",
  "parking",
  "vehicles",
  "admin",
  "other",
];
const STATUSES: Array<IssueStatus | "all"> = [
  "all",
  "open",
  "acknowledged",
  "progress",
  "pending",
  "resolved",
];

export default function IssueList({
  defaultDistrict,
}: {
  defaultDistrict?: District;
  showGreeting?: boolean;
  greetingName?: string;
}) {
  const [district, setDistrict] = useState<District | "all">(
    defaultDistrict ?? "all",
  );
  const [category, setCategory] = useState<Category | "all">("all");
  const [status, setStatus] = useState<IssueStatus | "all">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalIssue, setModalIssue] = useState<Issue | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [swipeDy, setSwipeDy] = useState(0);
  const [datesOpen, setDatesOpen] = useState(false);
  const [datesAnimOpen, setDatesAnimOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drawerScrollRef = useRef<HTMLDivElement>(null);
  // Extra bottom room so edit fields clear the on-screen keyboard on mobile.
  const kbInset = useKeyboardInset();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const { user } = useAuth();
  const defaultDistrictValue = defaultDistrict ?? "all";
  const hasActiveFilters =
    district !== defaultDistrictValue || category !== "all" || status !== "all";

  const { issues, loading, loadingMore, hasMore, error, fetchMore } = useIssues(
    { district, category, status, userId: user?.id },
  );

  function resetFilters() {
    setDistrict(defaultDistrictValue);
    setCategory("all");
    setStatus("all");
  }

  function openIssueModal(issue: Issue) {
    setSwipeDy(0);
    setModalIssue(issue);
  }

  function openDates() {
    setDatesOpen(true);
    requestAnimationFrame(() => setDatesAnimOpen(true));
  }

  function closeDates() {
    setDatesAnimOpen(false);
    setTimeout(() => setDatesOpen(false), 280);
  }

  function closeIssueModal() {
    setModalOpen(false);
    setDatesAnimOpen(false);
    setDatesOpen(false);
    setSwipeDy(0);
    setTimeout(() => setModalIssue(null), 280);
  }

  // Entrance animation: trigger open on next frame so transitions catch it
  useEffect(() => {
    if (modalIssue) {
      const id = requestAnimationFrame(() => setModalOpen(true));
      return () => cancelAnimationFrame(id);
    }
  }, [modalIssue]);

  // Native touch drag-to-close — must be passive:false to allow preventDefault
  useEffect(() => {
    if (!modalIssue) return;
    const el = drawerRef.current;
    if (!el) return;

    let startY = 0;
    let startX = 0;
    let dragging = false;
    let currentDy = 0;

    function onStart(e: TouchEvent) {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      dragging = false;
      currentDy = 0;
    }

    function onMove(e: TouchEvent) {
      const dy = e.touches[0].clientY - startY;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const scrollTop = drawerScrollRef.current?.scrollTop ?? 0;
      // Commit only when: at scroll top, moving down, AND vertical dominates horizontal
      // This lets horizontal gestures (e.g. BeforeAfterSlider) pass through unblocked
      if (!dragging && dy > 8 && scrollTop < 2 && dy > dx) {
        dragging = true;
      }
      if (dragging) {
        e.preventDefault(); // block scroll while dragging drawer
        currentDy = Math.max(0, dy);
        setSwipeDy(currentDy);
      }
    }

    function onEnd() {
      if (dragging && currentDy > 120) {
        closeIssueModal();
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
  }, [modalIssue]);

  // Close modal on Escape
  useEffect(() => {
    if (!modalIssue) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeIssueModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalIssue]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = modalIssue ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [modalIssue]);

  return (
    <>
      <div>
        <div
          suppressHydrationWarning
          className="sticky -top-1 z-20 mt-.5 border-b border-theme bg-theme-canvas py-2 lg:border-b-0">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className={`flex items-center justify-start gap-1.5 px-1 py-1 text-sm font-semibold transition-colors ${
                filtersOpen
                  ? "text-theme-ink"
                  : "text-theme-muted hover:text-theme-ink"
              }`}>
              <Filter size={13} className="shrink-0" />
              <span>{filtersOpen ? "Скриј филтри" : "Активирај филтри"}</span>
            </button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className=" px-2 py-1 text-xs font-medium text-theme-muted transition-colors hover:bg-theme-surface-muted hover:text-theme-ink">
                Ресетирај филтри
              </button>
            )}
          </div>

          {filtersOpen && (
            <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-theme bg-theme-surface p-1.5">
              {mounted ? (
                <>
                  <FilterSelect
                    value={district}
                    onChange={(v) => setDistrict(v as District | "all")}
                    isActive={district !== "all"}
                    options={DISTRICTS.map((d) => ({
                      value: d,
                      label: DISTRICT_LABELS[d] ?? d,
                    }))}
                  />
                  <FilterSelect
                    value={category}
                    onChange={(v) => setCategory(v as Category | "all")}
                    isActive={category !== "all"}
                    options={[
                      { value: "all", label: CATEGORY_ALL_LABEL_SHORT },
                      ...(
                        CATEGORIES.filter((c) => c !== "all") as Category[]
                      ).map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
                    ]}
                  />
                  <FilterSelect
                    value={status}
                    onChange={(v) => setStatus(v as IssueStatus | "all")}
                    isActive={status !== "all"}
                    options={[
                      { value: "all", label: STATUS_ALL_LABEL_SHORT },
                      ...(
                        STATUSES.filter((s) => s !== "all") as IssueStatus[]
                      ).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
                    ]}
                  />
                </>
              ) : (
                <>
                  <div className="h-9 rounded-lg border border-theme bg-theme-surface-muted" />
                  <div className="h-9 rounded-lg border border-theme bg-theme-surface-muted" />
                  <div className="h-9 rounded-lg border border-theme bg-theme-surface-muted" />
                </>
              )}
            </div>
          )}
        </div>

        <div className="w-full space-y-3 px-0 py-2">
          {loading && (
            <>
              <IssueCardSkeleton />
              <IssueCardSkeleton />
              <IssueCardSkeleton />
            </>
          )}
          {error && (
            <div className="text-xs text-red-600 border border-red-200 rounded p-3 bg-red-50">
              <p className="font-medium">Грешка при вчитување</p>
              <p className="text-red-500 mt-0.5">{error}</p>
            </div>
          )}
          {!loading && !error && issues.length === 0 && (
            <p className="text-xs text-zinc-400">Нема пријавени проблеми.</p>
          )}
          {issues.map((issue, index) => (
            <IssueCard
              key={issue.id}
              eagerImage={index < 2}
              issue={issue}
              userId={user?.id}
              onClick={() => openIssueModal(issue)}
            />
          ))}

          {!loading && hasMore && (
            <button
              onClick={fetchMore}
              disabled={loadingMore}
              className="w-full rounded-xl border border-[#dce6e2] bg-white py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-zinc-50 disabled:opacity-50">
              {loadingMore ? "Се вчитува…" : "Вчитај повеќе"}
            </button>
          )}
          {loadingMore && (
            <>
              <IssueCardSkeleton />
              <IssueCardSkeleton />
            </>
          )}
        </div>
      </div>

      {/* ── Issue modal overlay ─────────────────────────── */}
      {modalIssue && (
        <>
          {/* Desktop: Facebook-style multi-panel */}
          <div
            className="hidden lg:flex fixed inset-0 z-50 transition-opacity duration-300"
            style={{
              backgroundColor: "rgba(0,0,0,0.92)",
              opacity: modalOpen ? 1 : 0,
            }}
            onClick={closeIssueModal}>
            {/* Photo area — flex-1, shrinks naturally when side panels appear */}
            <div className="flex-1 flex items-center justify-center min-w-0 bg-black p-6">
              {modalIssue.photo_url && modalIssue.after_photo_url ? (
                <div
                  className="w-full max-w-3xl"
                  onClick={(e) => e.stopPropagation()}>
                  <BeforeAfterSlider
                    beforeSrc={modalIssue.photo_url}
                    afterSrc={modalIssue.after_photo_url}
                    alt={modalIssue.title}
                    maxHeight="82vh"
                    showLabels
                  />
                </div>
              ) : modalIssue.photo_url || modalIssue.after_photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cdnUrl((modalIssue.photo_url ?? modalIssue.after_photo_url)!)}
                  alt="Фотографија"
                  className="max-w-full object-contain rounded-xl cursor-zoom-in"
                  style={{ maxHeight: "82vh" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxSrc(
                      (modalIssue!.photo_url ?? modalIssue!.after_photo_url)!,
                    );
                  }}
                />
              ) : (
                <div className="text-zinc-600 text-sm">Нема фотографија</div>
              )}
            </div>

            {/* Dates panel — slides in from the left of the detail panel */}
            <div
              className={`shrink-0 h-full bg-white border-r border-zinc-100 flex flex-col overflow-hidden transition-all duration-300 ease-out ${datesOpen ? "w-80 opacity-100" : "w-0 opacity-0 pointer-events-none"}`}
              onClick={(e) => e.stopPropagation()}>
              {datesOpen && (
                <DateOffersPanel
                  issueId={modalIssue.id}
                  issueTitle={modalIssue.title}
                  userId={user?.id}
                  onClose={closeDates}
                />
              )}
            </div>

            {/* Issue detail panel */}
            <div
              className="w-105 shrink-0 bg-white flex flex-col overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>
              <IssueDetail
                issue={modalIssue}
                userId={user?.id}
                hideImage
                onClose={closeIssueModal}
                onOpenDates={() => (datesOpen ? closeDates() : openDates())}
              />
            </div>
          </div>

          {/* Mobile: backdrop — click to close */}
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300"
            style={{ opacity: modalOpen ? 1 : 0 }}
            onClick={closeIssueModal}
          />

          {/* Mobile: issue bottom drawer */}
          <div
            ref={drawerRef}
            className={`lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl flex flex-col${swipeDy === 0 ? " transition-transform duration-300 ease-out" : ""}`}
            style={{
              transform: modalOpen
                ? `translateY(${swipeDy}px)`
                : "translateY(100%)",
              maxHeight: "92dvh",
            }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab">
              <div className="h-1.5 w-12 rounded-full bg-zinc-300" />
            </div>
            <div
              ref={drawerScrollRef}
              className="overflow-y-auto flex-1"
              style={kbInset ? { paddingBottom: kbInset } : undefined}>
              <IssueDetail
                issue={modalIssue}
                userId={user?.id}
                onOpenDates={openDates}
              />
            </div>
          </div>

          {/* Mobile: dates panel — second sheet, slides over the issue drawer */}
          {datesOpen && (
            <>
              <div
                className="lg:hidden fixed inset-0 z-58 bg-black/30 transition-opacity duration-300"
                style={{ opacity: datesAnimOpen ? 1 : 0 }}
                onClick={closeDates}
              />
              <div
                className="lg:hidden fixed bottom-0 left-0 right-0 z-59 bg-white rounded-t-2xl shadow-2xl flex flex-col transition-transform duration-300 ease-out"
                style={{
                  maxHeight: "88dvh",
                  transform: datesAnimOpen
                    ? "translateY(0)"
                    : "translateY(100%)",
                }}>
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0 cursor-grab">
                  <div className="h-1.5 w-12 rounded-full bg-zinc-300" />
                </div>
                {/* Scrollable content — min-h-0 lets flex-1 shrink below intrinsic height */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <DateOffersPanel
                    issueId={modalIssue.id}
                    issueTitle={modalIssue.title}
                    userId={user?.id}
                    onClose={closeDates}
                  />
                </div>
              </div>
            </>
          )}

          {lightboxSrc && (
            <ImageLightbox
              src={lightboxSrc}
              alt={modalIssue.title}
              beforeSrc={modalIssue.photo_url}
              afterSrc={modalIssue.after_photo_url ?? null}
              onClose={() => setLightboxSrc(null)}
            />
          )}
        </>
      )}
    </>
  );
}
