/**
 * Add weekly kindergarten menu — 21.09 – 02.10.2026 (Наша Иднина, all institutions)
 *
 * DO NOT RUN before 21.09.2026 — the site shows the menu with the newest weekStart,
 * so running this early would replace the current (07.09) menu prematurely.
 *
 * Source: official menu photo. Salad row → snack2. First word capitalized.
 * Run on/after 21.09.2026:
 *   npx tsx scripts/add-menu-2026-09-21.ts
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

const MENU = {
  _id:   "menu-2026-09-21",
  _type: "menuPost",
  title: "Мени 21.09 - 02.10.2026",
  weekStart: "2026-09-21",
  weekEnd:   "2026-10-02",
  // No institution field — applies to all

  monday: {
    breakfast: "Леб со намаз и краставица",
    snack1:    "Тортица",
    lunch:     "Грав",
    snack2:    "Домати",
  },
  tuesday: {
    breakfast: "Корнфлекс со млеко",
    snack1:    "Праска",
    lunch:     "Гулаш со макарони и супа",
    snack2:    null,
  },
  wednesday: {
    breakfast: "Тарана со урда и чај",
    snack1:    "Интегрални бисквити, чај со мед",
    lunch:     "Растурена сарма",
    snack2:    null,
  },
  thursday: {
    breakfast: "Киснато со јогурт",
    snack1:    "Лубеница",
    lunch:     "Компир манџа",
    snack2:    "Зелка морков",
  },
  friday: {
    breakfast: "Овесни со јогурт",
    snack1:    "Геврек",
    lunch:     "Ориз со пилешки стек и супа",
    snack2:    null,
  },
};

async function run() {
  if (!process.env.SANITY_WRITE_TOKEN) {
    throw new Error("SANITY_WRITE_TOKEN missing from .env.local");
  }
  const clean = (obj: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null));
  const doc = {
    ...MENU,
    monday:    clean(MENU.monday),
    tuesday:   clean(MENU.tuesday),
    wednesday: clean(MENU.wednesday),
    thursday:  clean(MENU.thursday),
    friday:    clean(MENU.friday),
  };
  await client.createOrReplace(doc as Parameters<typeof client.createOrReplace>[0]);
  console.log(`  ✓ Menu: ${MENU.title}`);
}

run().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
