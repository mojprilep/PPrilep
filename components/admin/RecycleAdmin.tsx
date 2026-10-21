"use client";

/**
 * /admin/recycle — the Еко угостители list, from ПАКОМАК's data.
 * Venues are entered by hand or imported by pasting rows from ПАКОМАК's
 * Excel table (copied cells arrive tab-separated) or uploading a CSV.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import {
  deleteGreenVenue,
  importGreenVenues,
  saveGreenVenue,
  setGreenVenueActive,
  type VenueInput,
} from "../../app/actions/recycle";
import { VENUE_KIND_LABELS, type GreenVenue, type GreenVenueKind } from "../../lib/recycle";

const input =
  "w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-800 outline-none focus:border-teal-500";

// ── Import parsing ────────────────────────────────────────────────────────────

/** Minimal CSV/TSV parser: auto-detects tab / ; / , and honours "quoted, cells". */
function parseTable(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = firstLine.includes("\t")
    ? "\t"
    : (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

type Field = keyof VenueInput;

/**
 * Header → field, first match wins and each field is used once. Order matters:
 * "контакт телефон" must hit contact_phone before phone or contact_name.
 */
const HEADER_RULES: [Field, RegExp][] = [
  ["contact_phone", /(контакт|лице).*(тел|моб)|contact.*phone/],
  ["phone", /телефон|^тел|phone|мобил|mob|tel/],
  ["email", /e-?mail|е-?пошта|mail|пошта/],
  ["website", /веб|web|сајт|site|instagram|инстаграм|facebook|фејсбук|url/],
  ["edb", /едб|edb|даночен|ембс/],
  ["lat", /^lat|ширина|latitude/],
  ["lng", /^(lng|lon)|должина|longitude/],
  ["glass", /стакло|staklo|glass/],
  ["cans", /лимен|limen|can|метал|alu|алу/],
  ["partner_since", /од кога|почеток|датум|договор|since|date/],
  ["pakomak_ref", /пакомак|pakomak|шифра|^ref|^id$|^ид$|^бр|^r\.?b|^р\.?б/],
  ["kind", /тип|вид|дејност|kind|type|категорија/],
  ["address", /адреса|adresa|address|улица/],
  ["contact_name", /контакт|лице|сопственик|управител|одговор|contact|owner/],
  ["notes", /забелешк|белешк|notes?|коментар/],
  ["name", /назив|име|објект|name|naziv|фирма|угостител/],
];

function mapHeaders(headers: string[]): (Field | null)[] {
  const used = new Set<Field>();
  return headers.map((h) => {
    const s = h.trim().toLowerCase();
    if (!s) return null;
    for (const [field, re] of HEADER_RULES) {
      if (!used.has(field) && re.test(s)) {
        used.add(field);
        return field;
      }
    }
    return null;
  });
}

const FIELD_LABELS: Record<Field, string> = {
  name: "Назив",
  kind: "Тип",
  address: "Адреса",
  lat: "Lat",
  lng: "Lng",
  phone: "Телефон (јавен)",
  website: "Веб / Instagram",
  glass: "Стакло",
  cans: "Лименки",
  partner_since: "Со Пакомак од",
  edb: "ЕДБ",
  pakomak_ref: "Шифра Пакомак",
  contact_name: "Контакт лице",
  contact_phone: "Тел. на контакт",
  email: "Е-пошта",
  notes: "Забелешка",
};

// ── Component ─────────────────────────────────────────────────────────────────

const EMPTY: VenueInput = { name: "", kind: "cafe", glass: true, cans: false };

export default function RecycleAdmin({ initialVenues }: { initialVenues: GreenVenue[] }) {
  const [venues, setVenues] = useState(initialVenues);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; data: VenueInput } | null>(null);
  const [importing, setImporting] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) =>
      [v.name, v.address, v.edb, v.pakomak_ref, v.contact_name].some((s) => s?.toLowerCase().includes(q)),
    );
  }, [venues, query]);

  const activeCount = venues.filter((v) => v.active).length;

  function upsert(v: GreenVenue) {
    setVenues((list) => {
      const next = list.some((x) => x.id === v.id) ? list.map((x) => (x.id === v.id ? v : x)) : [...list, v];
      return next.sort((a, b) => a.name.localeCompare(b.name, "mk"));
    });
  }

  async function toggleActive(v: GreenVenue) {
    const { error } = await setGreenVenueActive(v.id, !v.active);
    if (error) return toast.error(error);
    upsert({ ...v, active: !v.active });
  }

  async function remove(v: GreenVenue) {
    if (!confirm(`Избриши „${v.name}“ од листата? (За привремено скривање користи „јавно“.)`)) return;
    const { error } = await deleteGreenVenue(v.id);
    if (error) return toast.error(error);
    setVenues((list) => list.filter((x) => x.id !== v.id));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        {activeCount} јавни од {venues.length} ·{" "}
        <a href="/recycle/eko-ugostiteli" target="_blank" rel="noopener noreferrer" className="text-teal-700 hover:underline">
          види ја јавната страница
        </a>
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Пребарај објект, адреса, ЕДБ…"
          className={`${input} min-w-0 flex-1`}
        />
        <button
          onClick={() => setEditing({ id: null, data: { ...EMPTY } })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700">
          <Plus size={15} /> Додај
        </button>
        <button
          onClick={() => setImporting(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
          <Upload size={15} /> Увези табела
        </button>
      </div>

      {editing && (
        <VenueForm
          key={editing.id ?? "new"}
          id={editing.id}
          initial={editing.data}
          onClose={() => setEditing(null)}
          onSaved={(v) => {
            upsert(v);
            setEditing(null);
          }}
        />
      )}
      {importing && (
        <VenueImport
          onClose={() => setImporting(false)}
          // An import touches many rows server-side — just reload the list.
          onDone={() => window.location.reload()}
        />
      )}

      {shown.length === 0 && (
        <p className="py-6 text-center text-sm text-zinc-500">
          {venues.length
            ? "Ништо не одговара на пребарувањето."
            : "Сè уште нема објекти — додај рачно или увези ја табелата од Пакомак."}
        </p>
      )}
      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {shown.map((v) => (
          <li key={v.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${v.active ? "" : "opacity-50"}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {v.name}{" "}
                <span className="text-xs font-normal text-zinc-500">
                  · {VENUE_KIND_LABELS[v.kind]} {v.glass && "· 🍾"} {v.cans && "· 🥫"}
                </span>
              </p>
              <p className="truncate text-xs text-zinc-500">
                {[v.address, v.edb && `ЕДБ ${v.edb}`, v.pakomak_ref && `Пакомак ${v.pakomak_ref}`]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <IconBtn title="Уреди" onClick={() => setEditing({ id: v.id, data: { ...v } })}>
                <Pencil size={15} />
              </IconBtn>
              <IconBtn title="Избриши" onClick={() => remove(v)}>
                <Trash2 size={15} />
              </IconBtn>
              <label className="ml-1 flex cursor-pointer items-center gap-1 text-[11px] text-zinc-500">
                <input type="checkbox" checked={v.active} onChange={() => toggleActive(v)} />
                јавно
              </label>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IconBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900">
      {children}
    </button>
  );
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-2xl border border-teal-200 bg-teal-50/40 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <button onClick={onClose} aria-label="Затвори" className="text-zinc-500 hover:text-zinc-900">
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  );
}

function VenueForm({
  id,
  initial,
  onClose,
  onSaved,
}: {
  id: number | null;
  initial: VenueInput;
  onClose: () => void;
  onSaved: (v: GreenVenue) => void;
}) {
  const [data, setData] = useState<VenueInput>(initial);
  const [saving, setSaving] = useState(false);
  const set = (field: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [field]: e.target.value }));
  const val = (field: Field) => String(data[field] ?? "");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: saved, error } = await saveGreenVenue(id, data);
    setSaving(false);
    if (error || !saved) return toast.error(error ?? "Грешка");
    toast.success(id ? "Зачувано" : "Објектот е додаден");
    onSaved(saved);
  }

  const publicFields: Field[] = ["address", "phone", "website", "lat", "lng"];
  const privateFields: Field[] = ["pakomak_ref", "edb", "contact_name", "contact_phone", "email"];

  return (
    <Panel title={id ? "Уреди објект" : "Нов објект"} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input required value={val("name")} onChange={set("name")} placeholder="Назив *" className={input} />
          <select value={val("kind") || "cafe"} onChange={set("kind")} className={input}>
            {(Object.keys(VENUE_KIND_LABELS) as GreenVenueKind[]).map((k) => (
              <option key={k} value={k}>
                {VENUE_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-700">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={data.glass === true}
              onChange={(e) => setData((d) => ({ ...d, glass: e.target.checked }))}
            />
            🍾 стакло
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={data.cans === true}
              onChange={(e) => setData((d) => ({ ...d, cans: e.target.checked }))}
            />
            🥫 лименки
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-xs text-zinc-500">Со Пакомак од</span>
            <input type="date" value={val("partner_since")} onChange={set("partner_since")} className={`${input} w-auto`} />
          </label>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Јавно</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {publicFields.map((f) => (
            <input key={f} value={val(f)} onChange={set(f)} placeholder={FIELD_LABELS[f]} className={input} />
          ))}
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Само за админ</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {privateFields.map((f) => (
            <input key={f} value={val(f)} onChange={set(f)} placeholder={FIELD_LABELS[f]} className={input} />
          ))}
        </div>
        <textarea
          value={val("notes")}
          onChange={set("notes")}
          placeholder="Интерна забелешка"
          rows={2}
          className={`${input} resize-none`}
        />
        <button
          disabled={saving}
          className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
          {saving ? "Се зачувува…" : "Зачувај"}
        </button>
      </form>
    </Panel>
  );
}

function VenueImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    const table = parseTable(raw.trim());
    if (table.length < 2) return null;
    const fields = mapHeaders(table[0]);
    const rows: VenueInput[] = table.slice(1).map((cells) => {
      const row: VenueInput = { name: "" };
      fields.forEach((f, i) => {
        if (f && cells[i]?.trim()) (row as unknown as Record<string, string>)[f] = cells[i].trim();
      });
      return row;
    });
    return { headers: table[0], fields, rows };
  }, [raw]);

  async function readFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setRaw(await file.text());
  }

  async function run() {
    if (!parsed) return;
    setBusy(true);
    const { data, error } = await importGreenVenues(parsed.rows);
    setBusy(false);
    if (error || !data) return toast.error(error ?? "Грешка");
    toast.success(`Нови: ${data.inserted} · ажурирани: ${data.updated} · прескокнати: ${data.skipped}`);
    onDone();
  }

  const hasName = parsed?.fields.includes("name");

  return (
    <Panel title="Увези табела од Пакомак" onClose={onClose}>
      <p className="text-xs leading-relaxed text-zinc-600">
        Во Excel означи ја табелата <strong>заедно со редот со наслови</strong>, копирај (Ctrl+C) и
        залепи тука — или прикачи CSV. Објектите со иста шифра од Пакомак или ЕДБ што веќе постојат
        се ажурираат, другите се додаваат.
      </p>
      <textarea
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        rows={6}
        placeholder="Залепи ги ќелиите тука…"
        className={`${input} font-mono text-xs`}
      />
      <input type="file" accept=".csv,.tsv,.txt" onChange={readFile} className="text-xs" />

      {parsed && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {parsed.headers.map((h, i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-0.5 text-[11px] ${
                  parsed.fields[i] ? "bg-teal-100 text-teal-800" : "bg-zinc-100 text-zinc-400 line-through"
                }`}>
                {h || "(празно)"}
                {parsed.fields[i] && ` → ${FIELD_LABELS[parsed.fields[i]!]}`}
              </span>
            ))}
          </div>
          {!hasName && (
            <p className="text-xs text-red-600">Не најдов колона за назив („Назив“, „Име“, „Објект“…).</p>
          )}
          <p className="text-xs text-zinc-600">
            {parsed.rows.length} редови · пр. <strong>{parsed.rows[0]?.name || "—"}</strong>
            {parsed.rows[0]?.address ? `, ${parsed.rows[0].address}` : ""}
          </p>
          <button
            onClick={run}
            disabled={busy || !hasName}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? "Се увезува…" : `Увези ${parsed.rows.length} редови`}
          </button>
        </div>
      )}
    </Panel>
  );
}
