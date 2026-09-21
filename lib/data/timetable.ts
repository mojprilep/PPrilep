/**
 * The station's OWN timetable, as published by Автобуска станица Прилеп.
 *
 * ── Why this exists next to lib/busStation.ts ────────────────────────────────
 * `lib/busStation.ts` reads pelagonija.mk, a third party's undocumented ticket
 * API. It is the only machine-readable source that exists, but it is a sales
 * portal: it publishes one price per departure and knows nothing about student
 * fares or return fares. The station sent us its own spreadsheet
 * ("Возен ред 01-09-2026.xlsx"), which has all four, so for the routes entered
 * here we show the station's numbers instead of the portal's.
 *
 * Being transcribed by hand is deliberate. The spreadsheet anchors its route
 * labels inconsistently — some sit in a merged block beside their rows, others
 * sit BELOW the rows they describe — so a mechanical import silently attaches
 * departures to the wrong destination. A wrong departure time in a civic app
 * means somebody stands at the station at 05:30 for a coach that left at 05:00.
 *
 * ── Adding a route ───────────────────────────────────────────────────────────
 * Copy one entry, keep times zero-padded ("5:30" in the sheet → "05:30"), and
 * carry the sheet's "*" over as `sunday: true`. A fare the sheet does not list
 * is `null` — never 0, and never guessed from another carrier's row.
 */

/** The date the station's sheet takes effect. Shown so nobody reads it as today's. */
export const TIMETABLE_EFFECTIVE_FROM = "2026-09-01";
export const TIMETABLE_EFFECTIVE_LABEL = "01.09.2026";

export type Fare = {
  /** Denars, one way, full price. */
  oneWay: number | null;
  /** Denars, one way, student. Null when the sheet doesn't list one. */
  oneWayStudent: number | null;
  /** Denars, return. */
  roundTrip: number | null;
  roundTripStudent: number | null;
};

export type ScheduledRun = {
  /** "05:30" — zero-padded, local Prilep time. */
  time: string;
  /** The sheet's "*": this coach also runs on Sunday. */
  sunday: boolean;
  /**
   * The sheet's "(од понед. до петок)" — this one departure skips the weekend
   * while the rest of its carrier's runs don't. Kept per-run rather than
   * per-line because that is how the sheet scopes it.
   */
  weekdaysOnly?: boolean;
  /**
   * When the sheet states the frequency in words instead of a marker — the
   * international rows say "секоја сабота", "секој ден", "среда и сабота".
   * A coach that leaves once a week is unusable information without this, so it
   * is shown verbatim next to the time rather than reduced to a symbol.
   */
  days?: string;
};

export type TimetableLine = {
  id: string;
  /** Shown under the carrier when the sheet says something the fields can't. */
  note?: string;
  /** Destination, matched against the page's search box. */
  to: string;
  /** "преку Велес" — the routing, when the sheet distinguishes one. */
  via: string | null;
  carrier: string;
  /** The carrier's home town, shown quietly — it is not a stop. */
  carrierOrigin: string | null;
  /** Set on international lines only, e.g. "Австрија". */
  country?: string;
  /**
   * Other spellings a rider might type. The international destinations are the
   * reason: the sheet prints "LAUSANNE" and "ЛОЗАНА" for the same city, and
   * somebody searching "Wien" should not be told there is no coach.
   */
  aliases?: string[];
  runs: ScheduledRun[];
  fare: Fare;
};

const run = (time: string, sunday = false): ScheduledRun => ({ time, sunday });
/** A departure whose frequency the sheet spells out in words. */
const on = (time: string, days: string): ScheduledRun => ({ time, sunday: false, days });
/** A departure that runs Monday to Friday only. */
const weekday = (time: string): ScheduledRun => ({ time, sunday: false, weekdaysOnly: true });

/**
 * The Скопје departures, named because Прилеп–Велес reuses them verbatim: the
 * sheet's Велес row carries no times of its own, only the words "ЛИНИИТЕ ЗА
 * СКОПЈЕ" and "КАКО ЗА СКОПЈЕ" — the Skopje coaches pass through Veles, so the
 * same buses serve both, at a lower fare. Sharing the arrays means a corrected
 * Skopje time can never drift out of sync with the Veles listing.
 */
const ROMAN_SKOPJE: ScheduledRun[] = [
  run("05:30"),
  run("06:30"),
  run("09:30", true),
  run("14:30", true),
  run("18:30", true),
];

const TRANSKOP_SKOPJE: ScheduledRun[] = [
  run("05:40"),
  run("07:15", true),
  run("08:10"),
  run("09:10", true),
  run("11:45"),
  run("15:15", true),
  run("17:15", true),
];

/**
 * Прилеп – Битола – Ресен – Охрид is ONE line per carrier, not three: the coach
 * leaves Prilep once and is sold at a different fare depending on where you get
 * off. The departure arrays are therefore shared by all three destinations, so a
 * corrected time can never drift between the listings.
 */
const EKSTRA_OHRID: ScheduledRun[] = [run("08:20")];
const GALEB_OHRID: ScheduledRun[] = [run("08:40", true), run("17:40", true)];

/**
 * Прилеп – Кичево runs преку Македонски Брод, and the sheet prices both: the
 * Кичево fare and, in the same cell, a cheaper "Македонски Брод" one. Same
 * coaches, two destinations — shared arrays, as with the Охрид line.
 */
const METRO_KICEVO: ScheduledRun[] = [run("09:00", true), run("13:15"), run("16:45", true)];
const RAMA_KICEVO: ScheduledRun[] = [run("11:20"), run("15:55")];

/**
 * The 15:00 Струмица Експрес coach: Прилеп – Кавадарци – Неготино – Валандово –
 * Струмица, one departure sold at four fares. The sheet stars it on the Струмица
 * row and not on the Кавадарци/Неготино rows; since it is physically one bus,
 * the star is carried on all of them.
 */
const STRUMICA_EKSPRES_1500: ScheduledRun[] = [run("15:00", true)];
/** The 16:00 Екстра Бус: Прилеп – Кавадарци – Неготино. */
const EKSTRA_1600: ScheduledRun[] = [run("16:00")];

export const TIMETABLE: readonly TimetableLine[] = [
  {
    id: "skopje-roman",
    to: "Скопје",
    via: "преку Велес",
    carrier: "Роман",
    carrierOrigin: "Прилеп",
    runs: ROMAN_SKOPJE,
    // The sheet puts 440 (one-way student) and 760 (return student) in the band
    // directly above РОМАН's row, with no carrier of its own. Read here as
    // РОМАН's, because that is the row it sits against — ТРАНСКОП's own row
    // repeats the 760 but never restates a 440, so it is not assumed for them.
    fare: { oneWay: 560, oneWayStudent: 440, roundTrip: 890, roundTripStudent: 760 },
  },
  {
    id: "skopje-transkop",
    to: "Скопје",
    via: "преку Велес",
    carrier: "Транскоп",
    carrierOrigin: "Битола",
    runs: TRANSKOP_SKOPJE,
    fare: { oneWay: 560, oneWayStudent: null, roundTrip: 890, roundTripStudent: 760 },
  },
  {
    id: "skopje-galeb",
    to: "Скопје",
    via: "преку Кавадарци и Велес",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    // Two Galeb runs to Скопје: a midday 12:47 (Охрид–Битола–Скопје) and the
    // evening 18:15 that continues to Белград. The portal lists both; the sheet
    // only carried the evening one, so 12:47 was the "missing Galeb time".
    runs: [run("12:47", true), run("18:15", true)],
    fare: { oneWay: 590, oneWayStudent: null, roundTrip: 1000, roundTripStudent: null },
  },

  // ── Прилеп – Велес ─────────────────────────────────────────────────────────
  // The sheet gives this route no times and no carriers of its own: the cells
  // read "ЛИНИИТЕ ЗА СКОПЈЕ" and "КАКО ЗА СКОПЈЕ", i.e. take the Skopje coaches
  // and pay 420/670 instead. So it is listed here as the same three carriers on
  // the same departures, at the Veles fare. ГАЛЕБ is the exception — its own row
  // prices Veles separately at 390/580.
  {
    id: "veles-roman",
    to: "Велес",
    via: null,
    note: "Со линиите за Скопје",
    carrier: "Роман",
    carrierOrigin: "Прилеп",
    runs: ROMAN_SKOPJE,
    fare: { oneWay: 420, oneWayStudent: null, roundTrip: 670, roundTripStudent: null },
  },
  {
    id: "veles-transkop",
    to: "Велес",
    via: null,
    note: "Со линиите за Скопје",
    carrier: "Транскоп",
    carrierOrigin: "Битола",
    runs: TRANSKOP_SKOPJE,
    fare: { oneWay: 420, oneWayStudent: null, roundTrip: 670, roundTripStudent: null },
  },
  {
    id: "veles-galeb",
    to: "Велес",
    via: "преку Кавадарци",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: [run("18:15", true)],
    fare: { oneWay: 390, oneWayStudent: null, roundTrip: 580, roundTripStudent: null },
  },

  // ── Прилеп – Битола ────────────────────────────────────────────────────────
  // Every carrier on this route publishes a one-way fare and "/" for the
  // return, i.e. no return ticket is sold — so roundTrip is null throughout.
  // Student fares are a Скопје-only arrangement and are absent here by design,
  // not by omission.
  {
    id: "bitola-transkop",
    to: "Битола",
    via: null,
    carrier: "Транскоп",
    carrierOrigin: "Битола",
    runs: [
      weekday("06:15"),
      run("11:30"),
      run("16:00", true),
      run("17:55", true),
      run("19:30"),
      run("21:30", true),
      run("23:15", true),
    ],
    fare: { oneWay: 220, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "bitola-ekstra",
    to: "Битола",
    via: null,
    carrier: "Екстра Бус",
    carrierOrigin: "Кавадарци",
    runs: EKSTRA_OHRID,
    fare: { oneWay: 200, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "bitola-galeb",
    to: "Битола",
    via: null,
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: GALEB_OHRID,
    fare: { oneWay: 220, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "bitola-strumica-ekspres",
    to: "Битола",
    via: null,
    carrier: "Струмица Експрес",
    carrierOrigin: "Струмица",
    runs: [run("09:00", true)],
    fare: { oneWay: 200, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },

  // ── Прилеп – Охрид ─────────────────────────────────────────────────────────
  // The same three coaches as Битола, continuing west. Both fares are listed
  // here, unlike Битола: on the long run the carriers do sell a return ticket.
  {
    id: "ohrid-ekstra",
    to: "Охрид",
    via: "преку Битола и Ресен",
    carrier: "Екстра Бус",
    carrierOrigin: "Кавадарци",
    runs: EKSTRA_OHRID,
    fare: { oneWay: 610, oneWayStudent: null, roundTrip: 880, roundTripStudent: null },
  },
  {
    id: "ohrid-galeb",
    to: "Охрид",
    via: "преку Битола и Ресен",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: GALEB_OHRID,
    fare: { oneWay: 630, oneWayStudent: null, roundTrip: 900, roundTripStudent: null },
  },

  // ── Прилеп – Ресен ─────────────────────────────────────────────────────────
  // Ресен is a stop on the Охрид line — the sheet names it in the route label
  // ("( Ресен )") but prices only the Охрид leg, so every fare here is null
  // rather than borrowed from the Охрид column. Somebody getting off at Ресен
  // pays less than the Охрид fare, and printing the Охрид number would overstate
  // it; the times are what we can state, and the station's phone answers the rest.
  {
    id: "resen-ekstra",
    to: "Ресен",
    via: "преку Битола",
    note: "Со линиите за Охрид",
    carrier: "Екстра Бус",
    carrierOrigin: "Кавадарци",
    runs: EKSTRA_OHRID,
    fare: { oneWay: null, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "resen-galeb",
    to: "Ресен",
    via: "преку Битола",
    note: "Со линиите за Охрид",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: GALEB_OHRID,
    fare: { oneWay: null, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },

  // ── Прилеп – Кавадарци ─────────────────────────────────────────────────────
  // The sheet packs three carriers into one row — "15:00; 16:00; 18:15" against
  // "220/290/350" against "СТРУМИЦА ЕКСПРЕС / ЕКСТРА БУС / ГАЛЕБ ОХРИД" — so the
  // three lists are read positionally, which the other rows corroborate: the
  // 18:15 ГАЛЕБ is the same coach the Скопје row lists as going преку Кавадарци.
  {
    id: "kavadarci-strumica-ekspres",
    to: "Кавадарци",
    via: null,
    note: "Со линијата за Струмица",
    carrier: "Струмица Експрес",
    carrierOrigin: "Струмица",
    runs: STRUMICA_EKSPRES_1500,
    fare: { oneWay: 220, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "kavadarci-ekstra",
    to: "Кавадарци",
    via: null,
    carrier: "Екстра Бус",
    carrierOrigin: "Кавадарци",
    runs: EKSTRA_1600,
    fare: { oneWay: 290, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "kavadarci-galeb",
    to: "Кавадарци",
    via: null,
    note: "Со линијата за Скопје",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: [run("18:15", true)],
    fare: { oneWay: 350, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },

  // ── Прилеп – Неготино ──────────────────────────────────────────────────────
  // Same positional reading: "15:00; 16:00" / "340/270" / "СТРУМИЦА ЕКСПРЕС /
  // ЕКСТРА БУС". Note the fares fall as the times rise — 340 then 270 — so this
  // is not a typo for an ascending pair.
  {
    id: "negotino-strumica-ekspres",
    to: "Неготино",
    via: "преку Кавадарци",
    carrier: "Струмица Експрес",
    carrierOrigin: "Струмица",
    runs: STRUMICA_EKSPRES_1500,
    fare: { oneWay: 340, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "negotino-ekstra",
    to: "Неготино",
    via: "преку Кавадарци",
    carrier: "Екстра Бус",
    carrierOrigin: "Кавадарци",
    runs: EKSTRA_1600,
    fare: { oneWay: 270, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },

  // ── Прилеп – Струмица ──────────────────────────────────────────────────────
  // Two unrelated coaches: a direct morning МАК ТРАВЕЛ, and the afternoon
  // СТРУМИЦА ЕКСПРЕС that works its way down through the Vardar valley.
  {
    id: "strumica-mak-travel",
    to: "Струмица",
    via: null,
    carrier: "Мак Травел",
    carrierOrigin: "Прилеп",
    runs: [run("06:00")],
    fare: { oneWay: 660, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    id: "strumica-strumica-ekspres",
    to: "Струмица",
    via: "преку Кавадарци, Неготино и Валандово",
    carrier: "Струмица Експрес",
    carrierOrigin: "Струмица",
    runs: STRUMICA_EKSPRES_1500,
    fare: { oneWay: 760, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },
  {
    // Валандово is named as a stop but never priced, so no fare is invented for
    // it — the same treatment Ресен gets on the Охрид line.
    id: "valandovo-strumica-ekspres",
    to: "Валандово",
    via: "преку Кавадарци и Неготино",
    note: "Со линијата за Струмица",
    carrier: "Струмица Експрес",
    carrierOrigin: "Струмица",
    runs: STRUMICA_EKSPRES_1500,
    fare: { oneWay: null, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },

  // ── Прилеп – Кочани ────────────────────────────────────────────────────────
  // The label carries "( Велес, Штип )" — the two towns this line passes through.
  // Neither is priced here, and both already have their own rows elsewhere in
  // the sheet, so they are recorded as routing rather than as destinations.
  {
    id: "kocani-galeb",
    to: "Кочани",
    via: "преку Велес и Штип",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: [run("08:40", true)],
    fare: { oneWay: 720, oneWayStudent: null, roundTrip: 1010, roundTripStudent: null },
  },

  // ── Прилеп – Кичево ────────────────────────────────────────────────────────
  {
    id: "kicevo-metro-trans",
    to: "Кичево",
    via: "преку Македонски Брод",
    carrier: "Метро Транс",
    carrierOrigin: "Прилеп",
    runs: METRO_KICEVO,
    fare: { oneWay: 350, oneWayStudent: null, roundTrip: 500, roundTripStudent: null },
  },
  {
    id: "kicevo-rama-turs",
    to: "Кичево",
    via: "преку Македонски Брод",
    carrier: "Рама Турс",
    carrierOrigin: "Прилеп",
    runs: RAMA_KICEVO,
    fare: { oneWay: 350, oneWayStudent: null, roundTrip: 500, roundTripStudent: null },
  },

  // ── Прилеп – Македонски Брод ───────────────────────────────────────────────
  // Priced in the same cell as Кичево, at 200/320 — the one intermediate stop on
  // this sheet that does get its own fare, so it is listed as a destination.
  {
    id: "makedonski-brod-metro-trans",
    to: "Македонски Брод",
    via: null,
    note: "Со линиите за Кичево",
    carrier: "Метро Транс",
    carrierOrigin: "Прилеп",
    runs: METRO_KICEVO,
    fare: { oneWay: 200, oneWayStudent: null, roundTrip: 320, roundTripStudent: null },
  },
  {
    id: "makedonski-brod-rama-turs",
    to: "Македонски Брод",
    via: null,
    note: "Со линиите за Кичево",
    carrier: "Рама Турс",
    carrierOrigin: "Прилеп",
    runs: RAMA_KICEVO,
    fare: { oneWay: 200, oneWayStudent: null, roundTrip: 320, roundTripStudent: null },
  },

  // ── Прилеп – Крушево ───────────────────────────────────────────────────────
  {
    id: "krusevo-gjoko-trans",
    to: "Крушево",
    via: null,
    carrier: "Ѓоко Транс",
    carrierOrigin: "Крушево",
    runs: [
      run("09:35", true),
      run("11:40"),
      run("14:45"),
      run("16:40"),
      run("19:30", true),
    ],
    fare: { oneWay: 200, oneWayStudent: null, roundTrip: null, roundTripStudent: null },
  },

  // ── Меѓународни линии ──────────────────────────────────────────────────────
  // These behave differently from everything above: some run once a week, so the
  // frequency is carried as words (`days`) rather than the Sunday star. Every
  // one of them sells a return ticket, which is why none of these are null.
  {
    id: "viena-euro-bus",
    to: "Виена",
    country: "Австрија",
    aliases: ["Wien", "Vienna", "Виена (A)"],
    via: null,
    carrier: "Евро Бус",
    carrierOrigin: "Струга",
    runs: [on("19:40", "секоја сабота")],
    fare: { oneWay: 4450, oneWayStudent: null, roundTrip: 8155, roundTripStudent: null },
  },
  {
    id: "sofija-transkop",
    to: "Софија",
    country: "Бугарија",
    aliases: ["Sofia", "Sofija"],
    via: null,
    carrier: "Транскоп",
    carrierOrigin: "Битола",
    runs: [on("05:40", "секој ден")],
    fare: { oneWay: 2230, oneWayStudent: null, roundTrip: 3680, roundTripStudent: null },
  },
  {
    id: "belgrad-galeb",
    to: "Белград",
    country: "Србија",
    aliases: ["Beograd", "Belgrade"],
    via: "преку Врање, Лесковац, Ниш и Јагодина",
    carrier: "Галеб",
    carrierOrigin: "Охрид",
    runs: [on("18:00", "секој ден")],
    fare: { oneWay: 2170, oneWayStudent: null, roundTrip: 3720, roundTripStudent: null },
  },
  {
    id: "frajburg-euro-lines",
    to: "Фрајбург",
    country: "Германија",
    aliases: ["Freiburg", "Фрајбург (D)"],
    via: null,
    carrier: "Евро Линес",
    carrierOrigin: "Струга",
    runs: [on("06:30", "среда и сабота")],
    fare: { oneWay: 7530, oneWayStudent: null, roundTrip: 13710, roundTripStudent: null },
  },
  {
    id: "lozana-solo-razen",
    to: "Лозана",
    country: "Швајцарија",
    aliases: ["Lausanne", "Лаузана"],
    via: null,
    carrier: "Соло Разен",
    carrierOrigin: null,
    runs: [on("06:30", "среда и сабота")],
    fare: { oneWay: 5720, oneWayStudent: null, roundTrip: 10770, roundTripStudent: null },
  },
];

/**
 * Every destination we hold the station's own times for, alphabetically.
 *
 * This is what the "сите дестинации" list shows — NOT the portal's 137 stations.
 * That list is every place the ticketing system knows about, most of which have
 * no coach from Prilep at all; offering it invites someone to tap a town and be
 * told there is nothing. These are the places you can actually get to.
 */
export function allDestinations(): string[] {
  return [...new Set(TIMETABLE.map((l) => l.to))].sort((a, b) =>
    a.localeCompare(b, "mk"),
  );
}

/**
 * Lines to `destination`, or an empty array when we haven't transcribed it yet.
 * Matched loosely so "скопје", "Скопје " and "СКОПЈЕ" all land.
 */
export function linesTo(destination: string): TimetableLine[] {
  const needle = destination.trim().toLocaleLowerCase("mk");
  if (!needle) return [];
  return TIMETABLE.filter(
    (l) =>
      l.to.toLocaleLowerCase("mk") === needle ||
      (l.aliases ?? []).some((a) => a.toLocaleLowerCase("mk") === needle),
  );
}

/**
 * Does this departure run on `weekday` (0 = Sunday, JS `getDay()` order)?
 *
 * The sheet expresses frequency three different ways and they have to agree
 * here: a "*" means the coach ALSO runs on Sunday, "(од понед. до петок)" means
 * it skips the weekend, and the international rows spell it out in words. The
 * unmarked default is Monday to Saturday, which is what the station's own
 * legend implies — the star exists precisely because Sunday is the exception.
 */
export function runsOn(r: ScheduledRun, weekday: number): boolean {
  if (r.days) {
    const d = r.days.toLocaleLowerCase("mk");
    if (d.includes("секој ден")) return true;
    // "среда и сабота", "секоја сабота" — scan for the day names it names.
    const NAMES = [
      ["недел"], ["понедел"], ["вторник"], ["среда", "среду"],
      ["четврток"], ["петок"], ["сабота", "саботa"],
    ];
    return NAMES[weekday]!.some((n) => d.includes(n));
  }
  if (r.weekdaysOnly) return weekday >= 1 && weekday <= 5;
  if (weekday === 0) return r.sunday;
  return true;
}

/** "05:30" → 330, for sorting and for comparing against the clock. */
export function minutesOf(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

export type UpcomingRun = {
  line: TimetableLine;
  run: ScheduledRun;
  minutes: number;
};

/**
 * Every departure to `destination` that runs on `weekday`, earliest first —
 * one flat chronological list across all carriers. The grouped view answers
 * "what does Роман run"; this answers "what is the next bus", which is the
 * question most people actually open the page with.
 */
export function runsForDay(destination: string, weekday: number): UpcomingRun[] {
  return linesTo(destination)
    .flatMap((line) =>
      line.runs
        .filter((run) => runsOn(run, weekday))
        .map((run) => ({ line, run, minutes: minutesOf(run.time) })),
    )
    .sort((a, b) => a.minutes - b.minutes);
}
