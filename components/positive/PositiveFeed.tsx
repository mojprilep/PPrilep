"use client";

import Link from "@/components/ui/Link";
import BlurImage from "../ui/BlurImage";
import { useState } from "react";
import { X } from "lucide-react";
import { urlForImage } from "../../lib/sanity/image";
import { formatMkDate } from "../../lib/utils";
import FilterSelect from "../ui/FilterSelect";
import type { PostListItem } from "../../lib/sanity/queries";

const CATEGORY_OPTIONS = [
  { value: "", label: "Сите категории" },
  { value: "Образование",     label: "Образование" },
  { value: "Спорт",           label: "Спорт" },
  { value: "Животна средина", label: "Животна средина" },
  { value: "Култура",         label: "Култура" },
  { value: "Деца и млади",    label: "Деца и млади" },
  { value: "Инфраструктура",  label: "Инфраструктура" },
  { value: "Здравство",       label: "Здравство" },
  { value: "Друго",           label: "Друго" },
];

interface Props {
  posts: PostListItem[];
}

export default function PositiveFeed({ posts }: Props) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? posts.filter((p) => (p.categories ?? []).includes(activeCategory))
    : posts;

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <div className="flex items-center gap-2">
        <FilterSelect
          value={activeCategory ?? ""}
          onChange={(v) => setActiveCategory(v || null)}
          options={CATEGORY_OPTIONS}
          placeholder="Сите категории"
          isActive={!!activeCategory}
          className="w-48"
        />
        {activeCategory && (
          <button
            onClick={() => setActiveCategory(null)}
            className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-700 transition-colors">
            <X size={12} />
            Откажи
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-zinc-700">
            {activeCategory
              ? "Нема приказни во оваа категорија."
              : "Сè уште нема објавени приказни."}
          </p>
          {activeCategory && (
            <button
              onClick={() => setActiveCategory(null)}
              className="mt-2 text-xs text-primary hover:underline">
              Прикажи ги сите
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {filtered.map((p) => {
            const tags = (p.tags ?? []).filter((t) => !!t?.title);
            return (
              <Link
                key={p._id}
                href={`/positive/${p.slug}`}
                className="group relative block overflow-hidden rounded-2xl border border-zinc-200 bg-white transition-all hover:border-zinc-300 hover:shadow-sm">
                {p.coverImage ? (
                  <BlurImage
                    src={urlForImage(p.coverImage).width(600).height(338).url()}
                    alt={p.coverImage.alt ?? p.title}
                    width={600}
                    height={338}
                    sizes="(max-width: 640px) 100vw, 300px"
                    wrapperClassName="aspect-video w-full bg-zinc-100"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="aspect-video w-full bg-zinc-100 flex items-center justify-center text-3xl">
                    ☀️
                  </div>
                )}
                {(p.categories ?? []).length > 0 && (
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    {p.categories[0]}
                  </span>
                )}
                <div className="p-3 space-y-1.5">
                  <h2 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </h2>
                  {p.excerpt && (
                    <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                      {p.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    {p.author && (
                      <span className="font-medium text-zinc-500">{p.author.name}</span>
                    )}
                    {p.author && <span>·</span>}
                    <time dateTime={p.publishedAt}>
                      {formatMkDate(p.publishedAt)}
                    </time>
                    {tags.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="truncate">{tags.map((t) => t.title).join(", ")}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
