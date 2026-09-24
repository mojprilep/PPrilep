"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import StreetAutocomplete from "../issues/StreetAutocomplete";
import { submitKomunalecRequest } from "../../app/actions/komunalec";
import type { KomunalecRequestType } from "../../lib/types/database";

const REQUEST_TYPES: [KomunalecRequestType, string][] = [
  ["complaint", "Поплака"],
  ["container", "Нарачај контејнер"],
  ["tractor", "Нарачај трактор"],
];

const DEFAULT_TIME = "09:00";

/** Keep only phone-ish chars and cap the digit count at 9 (MK format, e.g.
 *  075 000 000). Separators (space, -, /, +, parens) are preserved. */
function formatPhone(raw: string): string {
  const cleaned = raw.replace(/[^\d+()\s\-/]/g, "");
  let digits = 0;
  let out = "";
  for (const ch of cleaned) {
    if (/\d/.test(ch)) {
      if (digits >= 9) continue;
      digits++;
    }
    out += ch;
  }
  return out;
}

/** Tomorrow as a `date` input value (YYYY-MM-DD, local time). */
function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as a `date` input value — used as the min selectable date. */
function todayDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  loggedIn: boolean;
  defaultName?: string;
  defaultStreet?: string;
}

/**
 * Lets a resident send Комуналец a complaint or order a container / tractor.
 * The form is visible to everyone, but submitting requires sign-in. Anti-spam
 * throttling is enforced server-side in submitKomunalecRequest.
 */
export default function KomunalecContactForm({
  loggedIn,
  defaultName,
  defaultStreet,
}: Props) {
  const router = useRouter();

  const [type, setType] = useState<KomunalecRequestType>("complaint");
  const [date, setDate] = useState(tomorrowDate);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [name, setName] = useState(defaultName ?? "");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState(defaultStreet ?? "");
  const [streetNum, setStreetNum] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setType("complaint");
    setDate(tomorrowDate());
    setTime(DEFAULT_TIME);
    setPhone("");
    setStreetNum("");
    setMessage("");
  }

  async function submit() {
    if (!loggedIn) {
      toast.error("Најавете се за да испратите барање");
      router.push("/login");
      return;
    }
    if (!name.trim()) {
      toast.error("Внесете име");
      return;
    }
    if (phone.replace(/\D/g, "").length !== 9) {
      toast.error("Внесете валиден телефон (9 цифри, пр. 075 000 000)");
      return;
    }
    setSubmitting(true);

    const address =
      [street.trim(), streetNum.trim()].filter(Boolean).join(" ") || null;
    const scheduled_at =
      type !== "complaint" && date && time
        ? new Date(`${date}T${time}`).toISOString()
        : null;

    const res = await submitKomunalecRequest({
      request_type: type,
      category: null,
      full_name: name,
      phone,
      address,
      district: null,
      message: message || null,
      photo_url: null,
      scheduled_at,
    });
    setSubmitting(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Барањето е испратено до Комуналец");
    reset();
    // Full reload so the operator's "Барања" counter/queue (a client-side
    // fetch that router.refresh() wouldn't re-run) reflects the new request.
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 border-b border-zinc-100 pb-3">
        <h3 className="flex items-center gap-2 text-lg font-extrabold leading-tight text-theme-heading sm:text-xl">
          <Send size={18} className="text-primary" />
          Испрати барање до Комуналец
        </h3>
        <p className="mt-1 text-xs text-theme-muted">
          Поплака, нарачка на контејнер или трактор за собирање ѓубре.
        </p>
      </div>

      {/* Request type — dropdown on mobile, pills on sm+ */}
      <select
        value={type}
        onChange={(e) => setType(e.target.value as KomunalecRequestType)}
        className="mb-3 block w-full min-w-0 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-semibold outline-none focus:border-primary sm:hidden">
        {REQUEST_TYPES.map(([val, label]) => (
          <option key={val} value={val}>
            {label}
          </option>
        ))}
      </select>
      <div className="mb-3 hidden grid-cols-3 gap-1.5 sm:grid">
        {REQUEST_TYPES.map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setType(val)}
            className={`flex items-center justify-center rounded-lg border px-2 py-2.5 text-center text-xs font-semibold leading-tight transition-colors ${
              type === val
                ? "border-primary bg-primary text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:border-primary/50"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Preferred date + time — only for container/tractor orders */}
      {type !== "complaint" && (
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-theme-muted">
              Датум
            </span>
            <input
              type="date"
              value={date}
              min={todayDate()}
              onChange={(e) => setDate(e.target.value)}
              className="box-border block w-full min-w-0 max-w-full appearance-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-theme-muted">
              Време
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="box-border block w-full min-w-0 max-w-full appearance-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
            />
          </label>
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Име и презиме"
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          inputMode="tel"
          type="tel"
          placeholder="Телефон (075 000 000)"
          className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>

      {/* Street + house number (mirrors the issue report form) */}
      <div className="mb-3 flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <StreetAutocomplete
            value={street}
            onChange={setStreet}
            placeholder="Адреса / улица"
            inputClassName="w-full rounded-xl border border-zinc-200 pl-9 pr-4 py-3 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>
        <input
          value={streetNum}
          onChange={(e) => setStreetNum(e.target.value.replace(/[^\d\w/]/g, ""))}
          placeholder="Бр."
          maxLength={8}
          className="w-14 shrink-0 rounded-xl border border-zinc-200 px-2 text-center text-sm outline-none transition-colors focus:border-primary"
        />
      </div>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        placeholder={
          type === "complaint"
            ? "Опис на поплаката (опционално)"
            : "Детали — локација, количина, термин (опционално)"
        }
        className="mb-3 w-full resize-none rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none transition-colors focus:border-primary"
      />

      <button
        onClick={submit}
        disabled={submitting}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60">
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Се испраќа…
          </>
        ) : (
          <>
            <Send size={16} /> Испрати барање
          </>
        )}
      </button>

      {!loggedIn && (
        <p className="mt-2 text-center text-xs text-theme-muted">
          <Link href="/login" className="font-semibold text-primary underline">
            Најавете се
          </Link>{" "}
          за да го испратите барањето.
        </p>
      )}
    </div>
  );
}
