import { defineField, defineType } from "sanity";

/**
 * Лига (Распоред) — a single league's fixture list, round by round.
 *
 * Built for one league at a time (e.g. "Трета фудбалска лига Југ 2026/2027 —
 * Есенски дел"): the editorial team types the rounds and their matches here, and
 * fills in the score on each match once it's played. The site shows the next
 * upcoming round and the past results.
 *
 * `active` is the visibility switch — the web and the app show the one active
 * league PER SPORT (`sport`: football → /sport/raspored, handball →
 * /sport/rakomet). Keep one active per sport; flip the old one off when a new
 * season starts (the finished one stays in Studio as an archive). The sport
 * also sets the points for a win (football 3, handball 2).
 *
 * A match counts as PLAYED when BOTH scores are filled in; leave them empty for
 * an upcoming fixture. There is no separate "played" flag to keep in sync.
 */
export default defineType({
  name: "sportLeague",
  title: "Лига (Распоред)",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Име на лигата",
      type: "string",
      description: "пр. Трета фудбалска лига Југ",
      validation: (Rule) => Rule.required().max(120),
    }),
    defineField({
      name: "season",
      title: "Сезона",
      type: "string",
      description: "пр. 2026/2027",
      validation: (Rule) => Rule.max(40),
    }),
    defineField({
      name: "part",
      title: "Дел",
      type: "string",
      description: "пр. Есенски дел",
      validation: (Rule) => Rule.max(40),
    }),
    defineField({
      name: "sport",
      title: "Спорт",
      type: "string",
      description: "Фудбал = 3 бода за победа, ракомет = 2. Празно се смета за фудбал.",
      options: {
        list: [
          { title: "Фудбал", value: "football" },
          { title: "Ракомет", value: "handball" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
      initialValue: "football",
    }),
    defineField({
      name: "ourTeam",
      title: "Нашиот тим",
      type: "string",
      description: "Опционално — точно како во натпреварите (пр. ПРИЛЕП). Се истакнува во распоредот и табелата.",
    }),
    defineField({
      name: "active",
      title: "Активна",
      type: "boolean",
      description:
        "Само активната лига се прикажува на сајтот и во апликацијата. Држи само една активна по спорт.",
      initialValue: true,
    }),
    defineField({
      name: "rounds",
      title: "Кола",
      type: "array",
      of: [
        {
          type: "object",
          name: "round",
          title: "Коло",
          fields: [
            {
              name: "number",
              title: "Коло (број)",
              type: "number",
              validation: (Rule) => Rule.required().integer().min(1),
            },
            {
              name: "date",
              title: "Датум",
              type: "date",
              description: "Се користи за да се пресмета следното коло.",
              validation: (Rule) => Rule.required(),
            },
            {
              name: "dateLabel",
              title: "Датум (текст)",
              type: "string",
              description: "Опционално, пр. 12–13.09.2026. Ако е празно се прикажува датумот.",
            },
            {
              name: "matches",
              title: "Натпревари",
              type: "array",
              of: [
                {
                  type: "object",
                  name: "match",
                  title: "Натпревар",
                  fields: [
                    { name: "home", title: "Домаќин", type: "string", validation: (Rule) => Rule.required() },
                    { name: "away", title: "Гостин", type: "string", validation: (Rule) => Rule.required() },
                    { name: "homeScore", title: "Резултат (домаќин)", type: "number", validation: (Rule) => Rule.min(0).integer() },
                    { name: "awayScore", title: "Резултат (гостин)", type: "number", validation: (Rule) => Rule.min(0).integer() },
                  ],
                  preview: {
                    select: { home: "home", away: "away", hs: "homeScore", as: "awayScore" },
                    prepare({ home, away, hs, as }) {
                      const played = typeof hs === "number" && typeof as === "number";
                      return {
                        title: `${home ?? "?"} — ${away ?? "?"}`,
                        subtitle: played ? `${hs} : ${as}` : "не е одигран",
                      };
                    },
                  },
                },
              ],
            },
          ],
          preview: {
            select: { number: "number", date: "date", label: "dateLabel" },
            prepare({ number, date, label }) {
              return { title: `Коло ${number ?? "?"}`, subtitle: label || date || "" };
            },
          },
        },
      ],
    }),
  ],
  preview: {
    select: { title: "title", season: "season", part: "part", active: "active", sport: "sport" },
    prepare({ title, season, part, active, sport }) {
      return {
        title: `${active ? "🟢 " : ""}${title ?? "Лига"}`,
        subtitle: [sport === "handball" ? "Ракомет" : "Фудбал", season, part].filter(Boolean).join(" · "),
      };
    },
  },
});
