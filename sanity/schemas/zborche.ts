/**
 * ЗборЧе — the daily word game's puzzle.
 *
 * One document = one day's word. Authored ONLY here in the Studio: the app just
 * reads today's puzzle through /api/zborche, so there is no way to add a word
 * from the client. Nothing lives in Supabase — a player's progress is kept on
 * their own device, so the game costs nothing to run.
 *
 * Schedule words ahead by date. Difficulty is simply the word's length: start
 * the week with a 4-letter word and finish Sunday with 6, and the grid sizes
 * itself. Words must be uppercase Macedonian Cyrillic (the game compares
 * letter-for-letter and shows an on-screen Cyrillic keyboard).
 */

import { defineField, defineType } from "sanity";

// The 31 letters of the Macedonian alphabet, uppercase. A word may only use
// these — Latin look-alikes (C, A, O…) would never match on the keyboard.
const MK_UPPER = "АБВГДЃЕЖЗЅИЈКЛЉМНЊОПРСТЌУФХЦЧЏШ";

export default defineType({
  name: "zborche",
  title: "ЗборЧе (игра)",
  type: "document",
  icon: () => "🟩",
  fields: [
    defineField({
      name: "word",
      title: "Збор",
      type: "string",
      description:
        "Точниот збор за тој ден. Само македонски букви (се зачувува со ГОЛЕМИ " +
        "букви). Должина 4–6 — таа ја одредува тежината (4 = лесно, 6 = тешко).",
      validation: (r) =>
        r
          .required()
          .custom((value) => {
            if (typeof value !== "string") return "Внеси збор.";
            const w = value.trim().toUpperCase();
            if (w.length < 4 || w.length > 6) return "Зборот мора да има 4 до 6 букви.";
            for (const ch of w) {
              if (!MK_UPPER.includes(ch)) return `„${ch}“ не е македонска буква.`;
            }
            return true;
          }),
    }),
    defineField({
      name: "date",
      title: "Датум",
      type: "date",
      options: { dateFormat: "YYYY-MM-DD" },
      description: "Денот кога овој збор е активен. Еден збор по датум.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "hint",
      title: "Помош (опционално)",
      type: "string",
      description: "Мала помош што играчот може да ја открие. Остави празно ако не сакаш.",
      validation: (r) => r.max(120),
    }),
  ],

  // Newest first — the schedule reads like a calendar, next word on top.
  orderings: [
    {
      title: "Датум (најнов прв)",
      name: "dateDesc",
      by: [{ field: "date", direction: "desc" }],
    },
  ],

  preview: {
    select: { word: "word", date: "date" },
    prepare({ word, date }) {
      const w = typeof word === "string" ? word.toUpperCase() : "";
      return {
        title: w || "(без збор)",
        subtitle: `${date ?? "—"} · ${w.length} букви`,
      };
    },
  },
});
