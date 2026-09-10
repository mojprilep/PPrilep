/**
 * Sanity Studio structure — custom sidebar navigation.
 *
 * Organises document types into named sections so it's immediately obvious
 * which area of the site each document belongs to.
 *
 * TO ADD A NEW SECTION IN THE FUTURE:
 *   1. Create the schema in sanity/schemas/<name>.ts
 *   2. Register it in sanity/schemas/index.ts
 *   3. Add a S.listItem() block below inside the relevant section,
 *      or create a new section following the same pattern.
 *
 * StructureResolver docs:
 * https://www.sanity.io/docs/structure-builder-reference
 */

import type { StructureResolver } from "sanity/structure";

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Мој Прилеп — CMS")
    .items([

      // ── 📅 Случувања ─────────────────────────────────────────────────
      S.listItem()
        .title("📅 Случувања")
        .child(
          S.list()
            .title("Случувања")
            .items([
              // Citizen submissions awaiting review (isSubmission && not reviewed)
              S.listItem()
                .title("📥 Настани за преглед")
                .child(
                  S.documentList()
                    .title("Настани за преглед")
                    .filter('_type == "cityEvent" && isSubmission == true && reviewed != true')
                    .apiVersion("2024-01-01"),
                ),
              S.divider(),
              S.documentTypeListItem("cityEvent").title("Настани"),
            ]),
        ),

      S.divider(),

      // ── 🎬 Кино анкета ───────────────────────────────────────────────
      // Poll creation lives only here: the app and the API can add films and
      // votes to a poll, but never create one.
      S.listItem()
        .title("🎬 Кино анкети")
        .child(S.documentTypeList("moviePoll").title("Кино анкети")),
    S.listItem()
      .title("🍿 Одгледани филмови")
      .child(
        S.documentTypeList("pastScreening")
          .title("Одгледани филмови")
          .defaultOrdering([{ field: "screenedAt", direction: "desc" }]),
      ),

      S.divider(),

      // ── 🟩 ЗборЧе (daily word game) ──────────────────────────────────
      // Puzzles are authored only here; the app reads today's word through
      // /api/zborche. Schedule words ahead by date — length drives difficulty.
      S.listItem()
        .title("🟩 ЗборЧе")
        .child(
          S.documentTypeList("zborche")
            .title("ЗборЧе — зборови")
            .defaultOrdering([{ field: "date", direction: "desc" }]),
        ),

      S.divider(),

      // ── ✨ Позитива (blog) ────────────────────────────────────────────
      S.listItem()
        .title("✨ Позитива")
        .child(
          S.list()
            .title("Позитива")
            .items([
              // Citizen submissions awaiting review (isSubmission && not reviewed)
              S.listItem()
                .title("📥 Приказни за преглед")
                .child(
                  S.documentList()
                    .title("Приказни за преглед")
                    .filter('_type == "post" && isSubmission == true && reviewed != true')
                    .apiVersion("2024-01-01"),
                ),
              S.divider(),
              S.documentTypeListItem("post").title("Постови"),
              S.documentTypeListItem("author").title("Автори"),
              S.documentTypeListItem("tag").title("Тагови / Категории"),
            ]),
        ),

      S.divider(),

      // ── 🏗️ Наши Проекти ──────────────────────────────────────────────
      S.listItem()
        .title("🏗️ Наши Проекти")
        .child(
          S.list()
            .title("Наши Проекти")
            .items([
              S.documentTypeListItem("project").title("Проекти"),
            ]),
        ),

      S.divider(),

      // ── 🏅 Спорт и Рекреација ────────────────────────────────────
      // Club profiles arrive two ways: typed in here by the editorial team, or
      // submitted by the club through /sport/nov. Both land in the same
      // document type; the queue below is only the unreviewed submissions.
      S.listItem()
        .title("🏅 Спорт и Рекреација")
        .child(
          S.list()
            .title("Спорт и Рекреација")
            .items([
              S.listItem()
                .title("📥 Клубови за преглед")
                .child(
                  S.documentList()
                    .title("Клубови за преглед")
                    .filter('_type == "sportClub" && isSubmission == true && reviewed != true')
                    .apiVersion("2024-01-01"),
                ),
              S.listItem()
                .title("📥 Новости за преглед")
                .child(
                  S.documentList()
                    .title("Новости за преглед")
                    .filter('_type == "sportPost" && isSubmission == true && reviewed != true')
                    .apiVersion("2024-01-01"),
                ),
              S.divider(),
              S.documentTypeListItem("sportClub").title("Клубови"),
              S.documentTypeListItem("sportPost").title("Новости од клубовите"),
              S.documentTypeListItem("sportLeague").title("⚽ Лига (Распоред)"),
            ]),
        ),

      // ── Future sections — uncomment / copy the block when ready ──────
      //
      // S.divider(),
      //
      // S.listItem()
      //   .title("🏛️ Иницијативи")
      //   .child(
      //     S.list()
      //       .title("Иницијативи")
      //       .items([
      //         S.documentTypeListItem("initiative").title("Иницијативи"),
      //       ]),
      //   ),
      //
      // S.divider(),
      //
      // S.listItem()
      //   .title("🤝 Спонзори")
      //   .child(
      //     S.list()
      //       .title("Спонзори")
      //       .items([
      //         S.documentTypeListItem("sponsor").title("Спонзори"),
      //       ]),
      //   ),
      //
      // S.divider(),
      //
      // // Singleton — one document, no list
      // S.listItem()
      //   .title("⚙️ Подесувања на сајтот")
      //   .child(
      //     S.document()
      //       .schemaType("siteSettings")
      //       .documentId("siteSettings"),
      //   ),

    ]);
