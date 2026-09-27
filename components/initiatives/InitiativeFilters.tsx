"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { Filter } from "lucide-react";
import FilterSelect from "../ui/FilterSelect";
import { CATEGORY_LABELS_INIT, STAGE_LABEL, INITIATIVE_TABS, type InitiativeTab } from "../../lib/initiatives";
import { DISTRICT_LABELS } from "../../lib/utils";
import type { InitiativeCategory, District } from "../../lib/types/database";

const CATEGORIES = Object.keys(CATEGORY_LABELS_INIT) as InitiativeCategory[];
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

interface Props {
  category: string | null;
  district: string | null;
  stage: InitiativeTab;
}

export default function InitiativeFilters({ category, district, stage }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(true);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  function push(next: URLSearchParams) {
    next.delete("page");
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `/initiatives?${qs}` : "/initiatives", { scroll: false });
    });
  }

  function setParam(key: string, value: string, allValue = "all") {
    const next = new URLSearchParams(params.toString());
    if (!value || value === allValue) next.delete(key);
    else next.set(key, value);
    push(next);
  }

  function setStage(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("stage");
    else next.set("stage", value);
    push(next);
  }

  function resetAll() {
    const next = new URLSearchParams(params.toString());
    next.delete("category");
    next.delete("district");
    next.delete("stage");
    push(next);
  }

  const hasActive = !!category || !!district || stage !== "all";

  return (
    <div className={pending ? "opacity-70" : ""}>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center justify-start gap-1.5 px-1 py-1 text-sm font-semibold transition-colors ${
            open ? "text-theme-ink" : "text-theme-muted hover:text-theme-ink"
          }`}>
          <Filter size={13} className="shrink-0" />
          <span>{open ? "Скриј филтри" : "Активирај филтри"}</span>
        </button>

        {hasActive && (
          <button
            type="button"
            onClick={resetAll}
            className="px-2 py-1 text-xs font-medium text-theme-muted transition-colors hover:bg-theme-surface-muted hover:text-theme-ink">
            Ресетирај филтри
          </button>
        )}
      </div>

      {open && (
        <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-xl border border-theme bg-theme-surface p-1.5">
          {mounted ? (
            <>
              <FilterSelect
                value={district ?? "all"}
                isActive={!!district}
                onChange={(v) => setParam("district", v)}
                options={[
                  { value: "all", label: "Сите населби" },
                  ...DISTRICTS.map((d) => ({ value: d, label: DISTRICT_LABELS[d] ?? d })),
                ]}
              />
              <FilterSelect
                value={category ?? "all"}
                isActive={!!category}
                onChange={(v) => setParam("category", v)}
                options={[
                  { value: "all", label: "Сите категории" },
                  ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS_INIT[c] })),
                ]}
              />
              <FilterSelect
                value={stage}
                isActive={stage !== "all"}
                onChange={setStage}
                options={INITIATIVE_TABS.map((t) =>
                  t.value === "all"
                    ? { value: "all", label: "Сите стадиуми" }
                    : { value: t.value, label: STAGE_LABEL[t.value as keyof typeof STAGE_LABEL] ?? t.label },
                )}
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
  );
}
