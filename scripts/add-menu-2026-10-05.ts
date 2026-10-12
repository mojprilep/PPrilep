/**
 * Add weekly kindergarten menu — 05.10 – 16.10.2026 (Наша Иднина, all institutions)
 *
 * Two age groups per week — до 2 години (under2) and 2–6 години (age2to6). Each
 * becomes its own menuPost doc (`menu-<date>-<ageGroup>`); the site/app show an
 * age toggle above the day tabs. A group left entirely empty below is SKIPPED,
 * so a week with only one table still works.
 *
 * DO NOT RUN before 05.10.2026 — the site shows the menu with the newest weekStart,
 * so running this early would replace the current current menu prematurely.
 *
 * Source: official menu photo. Salad row → snack2. First word capitalized.
 * Run on/after 05.10.2026:
 *   npx tsx scripts/add-menu-2026-10-05.ts
 */

import { createClient } from "@sanity/client";
import * as path from "path";
import * as fs from "fs";

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf-8");
  raw.split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length) {
      const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) process.env[key.trim()] = val;
    }
  });
}

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? "81ctd9e6",
  dataset:   process.env.NEXT_PUBLIC_SANITY_DATASET    ?? "production",
  apiVersion: "2024-10-01",
  token:     process.env.SANITY_WRITE_TOKEN,
  useCdn:    false,
});

const WEEK = {
  title: "Мени 05.10 - 16.10.2026",
  weekStart: "2026-10-05",
  weekEnd:   "2026-10-16",
};

type Day = { breakfast?: string | null; snack1?: string | null; lunch?: string | null; salad?: string | null; snack2?: string | null };
type WeekDays = { monday: Day; tuesday: Day; wednesday: Day; thursday: Day; friday: Day };

const AGE_2_TO_6: WeekDays = {
  monday   : { breakfast: "Леб со путер, јајце и чај", snack1: "Чај со мед", lunch: "Грав и супа од моркови", salad: "Сезонска салата", snack2: "Овошен колач" },
  tuesday  : { breakfast: "Леб со млечен како крем и чај", snack1: "Чај со мед", lunch: "Манџа со јунешко мелено месо доматен сос и тестенини и крем супа од компири целер и пашканат со свеж магдонос", salad: "Сезонска салата", snack2: "Банана" },
  wednesday: { breakfast: "Кори со сирење и јогурт", snack1: "Чај со мед", lunch: "Растурена сарма со јунешко месо и крем супа од мешан зеленчук", salad: "Сезонска салата", snack2: "Пудинг" },
  thursday : { breakfast: "Крофна со млеко", snack1: "Чај со мед", lunch: "Компир манџа со јунешко мелено месо и грашак и супа од јунешко месо и зеленчук", salad: "Сезонска салата", snack2: "Портокал" },
  friday   : { breakfast: "Житарки со млеко", snack1: "Чај со мед", lunch: "Ориз со пилешко месо и пилешка чорба", salad: "Сезонска салата", snack2: "Кроасан" },
};

const UNDER_2: WeekDays = {
  monday   : { breakfast: "Намаз од јајце, павлака и сирење со леб", snack1: "Чај со мед", lunch: "Грав и супа од моркови", salad: "Сезонска салата", snack2: "Овошен колач" },
  tuesday  : { breakfast: "Житна каша со млеко и чоколадо", snack1: "Чај со мед", lunch: "Манџа со јунешко мелено месо доматен сос и тестенини и крем супа од компири целер и пашканат со свеж магдонос", salad: "Сезонска салата", snack2: "Банана" },
  wednesday: { breakfast: "Кашичка од кори со сирење и јогурт", snack1: "Чај со мед", lunch: "Растурена сарма со јунешко месо и крем супа од мешан зеленчук", salad: "Сезонска салата", snack2: "Пудинг" },
  thursday : { breakfast: "Кашичка од палента со пире од јаболко", snack1: "Чај со мед", lunch: "Компир манџа со јунешко мелено месо и грашак и супа од јунешко месо и зеленчук", salad: "Сезонска салата", snack2: "Портокал" },
  friday   : { breakfast: "Овесна каша со јогурт", snack1: "Чај со мед", lunch: "Ориз со пилешко месо и пилешка чорба", salad: "Сезонска салата", snack2: "Пченкарни стапчина" },
};

const GROUPS = [
  { ageGroup: "under2" as const, days: UNDER_2 },
  { ageGroup: "age2to6" as const, days: AGE_2_TO_6 },
];

const clean = (obj: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v != null && v !== ""));

const hasFood = (w: WeekDays) =>
  (Object.values(w) as Day[]).some((d) => Object.keys(clean(d)).length > 0);

async function run() {
  if (!process.env.SANITY_WRITE_TOKEN) {
    throw new Error("SANITY_WRITE_TOKEN missing from .env.local");
  }
  for (const { ageGroup, days } of GROUPS) {
    if (!hasFood(days)) {
      console.log(`  - skipped ${ageGroup} (no dishes entered)`);
      continue;
    }
    const doc = {
      _id:   `menu-${WEEK.weekStart}-${ageGroup}`,
      _type: "menuPost",
      ageGroup,
      ...WEEK,
      monday:    clean(days.monday),
      tuesday:   clean(days.tuesday),
      wednesday: clean(days.wednesday),
      thursday:  clean(days.thursday),
      friday:    clean(days.friday),
    };
    await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
    console.log(`  ✓ ${WEEK.title} — ${ageGroup}`);
  }
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
