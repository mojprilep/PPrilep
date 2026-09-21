import { defineField, defineType } from "sanity";

// Shared day fields — reused for each weekday
const DAY_FIELDS = [
  defineField({ name: "breakfast", title: "Појадок",   type: "text",   rows: 2 }),
  defineField({ name: "snack1",    title: "Ужина I",   type: "string" }),
  defineField({ name: "lunch",     title: "Ручек",     type: "text",   rows: 2 }),
  defineField({ name: "salad",     title: "Салата",    type: "string" }),
  defineField({ name: "snack2",    title: "Ужина II",  type: "string" }),
];

export default defineType({
  name: "menuPost",
  title: "Неделно мени",
  type: "document",
  fields: [
    defineField({
      name: "institution", title: "Установа (незадолжително — остави празно за сите)",
      type: "reference", to: [{ type: "institution" }],
    }),
    defineField({
      name: "ageGroup",
      title: "Возрасна група",
      type: "string",
      description: "Секоја недела има две менија — до 2 години и 2–6 години.",
      options: {
        list: [
          { title: "До 2 години", value: "under2" },
          { title: "2–6 години", value: "age2to6" },
        ],
        layout: "radio",
      },
      initialValue: "age2to6",
      validation: (R) => R.required(),
    }),
    defineField({ name: "weekStart", title: "Прва недела — Понеделник", type: "date", validation: (R) => R.required() }),
    defineField({ name: "weekEnd",   title: "Последна недела — Петок",  type: "date" }),
    defineField({ name: "title",     title: "Наслов",                    type: "string", description: "пр. Мени 18.05 – 29.05.2026" }),
    defineField({ name: "monday",    title: "Понеделник", type: "object", fields: DAY_FIELDS }),
    defineField({ name: "tuesday",   title: "Вторник",    type: "object", fields: DAY_FIELDS }),
    defineField({ name: "wednesday", title: "Среда",      type: "object", fields: DAY_FIELDS }),
    defineField({ name: "thursday",  title: "Четврток",   type: "object", fields: DAY_FIELDS }),
    defineField({ name: "friday",    title: "Петок",      type: "object", fields: DAY_FIELDS }),
  ],
  preview: {
    select: { title: "title", subtitle: "weekStart", ageGroup: "ageGroup" },
    prepare: ({ title, subtitle, ageGroup }) => {
      const age = ageGroup === "under2" ? "до 2 год." : ageGroup === "age2to6" ? "2–6 год." : "";
      return {
        title: [title ?? `Мени ${subtitle}`, age].filter(Boolean).join(" · "),
        media: () => "🍽️",
      };
    },
  },
  orderings: [{ title: "По датум (најново)", name: "weekDesc", by: [{ field: "weekStart", direction: "desc" }] }],
});
