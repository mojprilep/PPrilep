"use client";

/**
 * The club's own edit form.
 *
 * Same fields, same shapes and same warning behaviour as /sport/nov — a club
 * that filled in the application recognises this screen. What it deliberately
 * does NOT show is the name, the kind and the slug: renaming the slug would
 * break the club's own URL and orphan its Postgres binding, and `verified` is
 * our statement about them rather than theirs. Those stay with the editors.
 *
 * Access is decided on the server, twice: this page 404s for anyone who is not
 * the owner, and /api/sport/club refuses the write regardless of what the page
 * let through.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "@/components/ui/Link";
import { Check, ImagePlus, Plus, Trash2 } from "lucide-react";

import {
  AGE_LABEL,
  DAY_SHORT,
  PERIOD_LABEL,
  type SportClub,
} from "../../../../../lib/sanity/sport";
import { urlForImage } from "../../../../../lib/sanity/image";
import {
  AGE_ORDER,
  DAY_ORDER,
  EMPTY_PRICE,
  EMPTY_SLOT,
  Field,
  LATIN,
  Toggle,
  inputCls,
  type Price,
  type Slot,
} from "../../../../../components/sport/FormBits";

export default function EditClubForm({ club }: { club: SportClub }) {
  const router = useRouter();

  const [name, setName] = useState(club.name ?? "");
  const [sports, setSports] = useState((club.sports ?? []).join(", "));
  const [shortDescription, setShortDescription] = useState(club.shortDescription ?? "");
  const [about, setAbout] = useState(club.about ?? "");
  const [ageGroups, setAgeGroups] = useState<string[]>(club.ageGroups ?? []);
  const [gender, setGender] = useState(club.gender ?? "mixed");
  const [schedule, setSchedule] = useState<Slot[]>(
    (club.schedule ?? []).length
      ? club.schedule.map((s) => ({
          group: s.group,
          days: s.days ?? [],
          startTime: s.startTime,
          endTime: s.endTime ?? "",
          venue: s.venue ?? "",
        }))
      : [{ ...EMPTY_SLOT }],
  );
  const [pricing, setPricing] = useState<Price[]>(
    (club.pricing ?? []).length
      ? club.pricing.map((p) => ({
          label: p.label,
          price: String(p.price),
          period: p.period,
          note: p.note ?? "",
        }))
      : [{ ...EMPTY_PRICE }],
  );
  const [freeTrial, setFreeTrial] = useState(club.freeTrial);
  const [acceptingMembers, setAcceptingMembers] = useState(club.acceptingMembers);
  const [howToJoin, setHowToJoin] = useState(club.howToJoin ?? "");
  const [joinUrl, setJoinUrl] = useState(club.joinUrl ?? "");
  const [venue, setVenue] = useState(club.venue ?? "");
  const [address, setAddress] = useState(club.address ?? "");
  const [district, setDistrict] = useState(club.district ?? "");
  const [phone, setPhone] = useState(club.phone ?? "");
  const [email, setEmail] = useState(club.email ?? "");
  const [website, setWebsite] = useState(club.website ?? "");
  const [facebook, setFacebook] = useState(club.facebook ?? "");
  const [instagram, setInstagram] = useState(club.instagram ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // The images already on the profile, so the club sees what it is replacing.
  const currentLogo = club.logo
    ? urlForImage(club.logo).width(128).height(128).fit("crop").url()
    : null;
  const currentCover = club.coverImage
    ? urlForImage(club.coverImage).width(800).height(320).fit("crop").url()
    : null;

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One warning line, not one per field — a form covered in red reads as
  // broken rather than as a suggestion.
  const latinWarning = [shortDescription, about, howToJoin, venue, district]
    .concat(schedule.map((s) => s.group))
    .concat(pricing.map((p) => p.label))
    .some((v) => LATIN.test(v));

  const setSlot = (i: number, patch: Partial<Slot>) =>
    setSchedule((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setPrice = (i: number, patch: Partial<Price>) =>
    setPricing((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const form = new FormData();
    form.set("slug", club.slug);
    form.set("name", name);
    form.set("sports", sports);
    form.set("shortDescription", shortDescription);
    form.set("about", about);
    form.set("howToJoin", howToJoin);
    form.set("joinUrl", joinUrl);
    form.set("ageGroups", ageGroups.join(","));
    form.set("level", (club.level ?? []).join(","));
    form.set("gender", gender);
    form.set("acceptingMembers", String(acceptingMembers));
    form.set("freeTrial", String(freeTrial));
    form.set("venue", venue);
    form.set("address", address);
    form.set("district", district);
    form.set("phone", phone);
    form.set("email", email);
    form.set("website", website);
    form.set("facebook", facebook);
    form.set("instagram", instagram);
    // Repeating rows travel as JSON: a flat encoding would turn them into
    // `schedule[0][days][2]`-style keys that both sides parse by hand.
    form.set(
      "schedule",
      JSON.stringify(schedule.filter((s) => s.group.trim() && s.startTime)),
    );
    form.set(
      "pricing",
      JSON.stringify(pricing.filter((p) => p.label.trim() && p.price !== "")),
    );
    if (logo) form.set("logo", logo);
    if (cover) form.set("cover", cover);

    try {
      const res = await fetch("/api/sport/club", { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Нешто тргна наопаку.");
      setSaved(true);
      // The public page is cached; refresh so the club sees its own change.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Нешто тргна наопаку.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <div>
        <Link href={`/sport/${club.slug}`} className="text-xs font-semibold text-teal-600">
          ← {club.name}
        </Link>
        <h1 className="mt-1 text-base font-bold text-theme-heading">Уреди го профилот</h1>
        <p className="text-xs text-theme-muted">
          Промените се објавуваат веднаш. Адресата на профилот (линкот) останува
          иста — јави ни се ако треба да се смени.
        </p>
      </div>

      {latinWarning ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
          Дел од текстот е на латиница. Профилите се на кирилица — провери пред да
          зачуваш. (Линковите и меилот се во ред.)
        </p>
      ) : null}

      {/* ── Basics ────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <Field label="Име на клубот">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <Field label="Спортови" hint="Одвоени со запирка.">
          <input className={inputCls} value={sports} onChange={(e) => setSports(e.target.value)} />
        </Field>

        <Field label="Кратко опис" hint="До 220 знаци — ова се гледа во листата.">
          <textarea
            className={inputCls}
            rows={2}
            maxLength={220}
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
          />
        </Field>

        <Field label="За клубот">
          <textarea
            className={inputCls}
            rows={5}
            value={about}
            onChange={(e) => setAbout(e.target.value)}
          />
        </Field>

        <Field label="Лого" hint="Остави празно за да го задржиш постојното.">
          <div className="flex items-center gap-3">
            {logoPreview || currentLogo ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoPreview ?? currentLogo ?? ""}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
            ) : null}
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-teal-600">
              <ImagePlus className="h-4 w-4" />
              {logo ? logo.name : logoPreview || currentLogo ? "Смени слика" : "Избери слика"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setLogo(file);
                  setLogoPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
            </label>
          </div>
        </Field>

        <Field label="Насловна слика" hint="Широка слика на врвот на профилот. Остави празно за да ја задржиш постојната.">
          {coverPreview || currentCover ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={coverPreview ?? currentCover ?? ""}
              alt=""
              className="mb-2 h-28 w-full rounded-xl object-cover"
            />
          ) : null}
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-teal-600">
            <ImagePlus className="h-4 w-4" />
            {cover ? cover.name : coverPreview || currentCover ? "Смени слика" : "Избери слика"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setCover(file);
                setCoverPreview(file ? URL.createObjectURL(file) : null);
              }}
            />
          </label>
        </Field>
      </section>

      {/* ── Location (matches the profile: right below „За клубот“) ────────── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-zinc-700">Локација</p>
        <Field label="Сала / објект">
          <input className={inputCls} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </Field>
        <Field label="Адреса">
          <input className={inputCls} value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Населба">
          <input className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} />
        </Field>
      </section>

      {/* ── Who it is for ─────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <p className="text-xs font-semibold text-zinc-700">За кого</p>
        <div className="flex flex-wrap gap-1.5">
          {AGE_ORDER.map((a) => (
            <Toggle
              key={a}
              active={ageGroups.includes(a)}
              onClick={() =>
                setAgeGroups((prev) =>
                  prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
                )
              }
            >
              {AGE_LABEL[a] ?? a}
            </Toggle>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(["mixed", "male", "female"] as const).map((g) => (
            <Toggle key={g} active={gender === g} onClick={() => setGender(g)}>
              {{ mixed: "Мешано", male: "Машки", female: "Женски" }[g]}
            </Toggle>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Toggle active={acceptingMembers} onClick={() => setAcceptingMembers((v) => !v)}>
            {acceptingMembers ? "Прима нови членови" : "Уписот е затворен"}
          </Toggle>
          <Toggle active={freeTrial} onClick={() => setFreeTrial((v) => !v)}>
            Прв тренинг бесплатно
          </Toggle>
        </div>
      </section>

      {/* ── Schedule ──────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <p className="text-xs font-semibold text-zinc-700">Распоред на тренинзи</p>
        {schedule.map((slot, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Група (пр. Деца 7–11)"
                value={slot.group}
                onChange={(e) => setSlot(i, { group: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setSchedule((rows) => rows.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg px-2 text-zinc-400 hover:text-red-500"
                aria-label="Избриши"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {DAY_ORDER.map((d) => (
                <Toggle
                  key={d}
                  active={slot.days.includes(d)}
                  onClick={() =>
                    setSlot(i, {
                      days: slot.days.includes(d)
                        ? slot.days.filter((x) => x !== d)
                        : [...slot.days, d],
                    })
                  }
                >
                  {DAY_SHORT[Number(d)]}
                </Toggle>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="time"
                className={inputCls}
                value={slot.startTime}
                onChange={(e) => setSlot(i, { startTime: e.target.value })}
              />
              <input
                type="time"
                className={inputCls}
                value={slot.endTime}
                onChange={(e) => setSlot(i, { endTime: e.target.value })}
              />
            </div>
            <input
              className={inputCls}
              placeholder="Сала / терен"
              value={slot.venue}
              onChange={(e) => setSlot(i, { venue: e.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSchedule((rows) => [...rows, { ...EMPTY_SLOT }])}
          className="flex items-center gap-1 text-xs font-semibold text-teal-600"
        >
          <Plus className="h-3.5 w-3.5" /> Додај термин
        </button>
      </section>

      {/* ── Prices ────────────────────────────────────────────────────────── */}
      <section className="space-y-2">
        <p className="text-xs font-semibold text-zinc-700">Ценовник</p>
        {pricing.map((item, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-zinc-200 p-3">
            <div className="flex gap-2">
              <input
                className={inputCls}
                placeholder="Ставка (пр. Месечна членарина)"
                value={item.label}
                onChange={(e) => setPrice(i, { label: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setPricing((rows) => rows.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg px-2 text-zinc-400 hover:text-red-500"
                aria-label="Избриши"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                className={inputCls}
                placeholder="Цена (ден.)"
                value={item.price}
                onChange={(e) => setPrice(i, { price: e.target.value })}
              />
              <select
                className={inputCls}
                value={item.period}
                onChange={(e) => setPrice(i, { period: e.target.value })}
              >
                {Object.entries(PERIOD_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <input
              className={inputCls}
              placeholder="Забелешка (по избор)"
              value={item.note}
              onChange={(e) => setPrice(i, { note: e.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setPricing((rows) => [...rows, { ...EMPTY_PRICE }])}
          className="flex items-center gap-1 text-xs font-semibold text-teal-600"
        >
          <Plus className="h-3.5 w-3.5" /> Додај ставка
        </button>
      </section>

      {/* ── How to join (matches the profile: „Како да се зачлениш“) ───────── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-zinc-700">Како да се зачлениш</p>
        <Field label="Како да се зачлениш">
          <textarea
            className={inputCls}
            rows={3}
            value={howToJoin}
            onChange={(e) => setHowToJoin(e.target.value)}
          />
        </Field>
        <Field label="Линк за зачленување" hint="Формулар или страница за пријава — се појавува копче „Зачлени се“.">
          <input
            className={inputCls}
            value={joinUrl}
            onChange={(e) => setJoinUrl(e.target.value)}
            placeholder="https://"
          />
        </Field>
      </section>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-xs font-semibold text-zinc-700">Контакт</p>
        <Field label="Телефон">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Меил">
          <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Веб страна">
          <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} />
        </Field>
        <Field label="Facebook">
          <input className={inputCls} value={facebook} onChange={(e) => setFacebook(e.target.value)} />
        </Field>
        <Field label="Instagram">
          <input className={inputCls} value={instagram} onChange={(e) => setInstagram(e.target.value)} />
        </Field>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-teal-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {saving ? "Се зачувува…" : "Зачувај"}
        </button>
        {saved ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-teal-600">
            <Check className="h-4 w-4" /> Зачувано
          </span>
        ) : null}
      </div>
    </form>
  );
}
