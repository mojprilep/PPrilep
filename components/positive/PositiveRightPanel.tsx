"use client";

import Link from "@/components/ui/Link";
import Image from "next/image";
import { useState } from "react";
import { useAuthContext } from "../../lib/context/AuthContext";
import { urlForImage } from "../../lib/sanity/image";
import { formatMkDate } from "../../lib/utils";
import type { PostListItem } from "../../lib/sanity/queries";
import SubmitStoryModal from "./SubmitStoryModal";

interface Props {
  recentPosts: PostListItem[];
}

export default function PositiveRightPanel({ recentPosts }: Props) {
  const { user } = useAuthContext();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-5 p-3">
      {/* Submit CTA */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">📤 Сподели приказна</h3>
          <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">
            Имаш добра вест од Прилеп? Испрати ни ја — ние ја споделуваме со градот.
          </p>
        </div>
        {user ? (
          <button
            onClick={() => setModalOpen(true)}
            className="w-full rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition-colors">
            Испрати приказна
          </button>
        ) : (
          <Link
            href="/account"
            className="block w-full rounded-xl border border-zinc-200 px-4 py-2 text-center text-xs font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
            Најави се за да испратиш
          </Link>
        )}
      </div>

      {/* Recent posts */}
      {recentPosts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-0.5">
            Последни вести
          </h3>
          <div className="space-y-1">
            {recentPosts.map((p) => (
              <Link
                key={p._id}
                href={`/positive/${p.slug}`}
                className="flex items-start gap-3 rounded-xl p-2 hover:bg-zinc-50 transition-colors group">
                {p.coverImage ? (
                  <div className="relative w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-zinc-100">
                    <Image
                      src={urlForImage(p.coverImage).width(112).height(112).url()}
                      alt={p.coverImage.alt ?? p.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 shrink-0 rounded-lg bg-zinc-100 flex items-center justify-center text-xl">
                    ☀️
                  </div>
                )}
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-xs font-medium text-zinc-800 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {p.title}
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    {formatMkDate(p.publishedAt, false)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
          <Link
            href="/positive"
            className="block text-center text-xs text-primary hover:underline pt-1">
            Сите вести →
          </Link>
        </div>
      )}

      {modalOpen && (
        <SubmitStoryModal
          userEmail={user?.email}
          userName={user?.user_metadata?.full_name}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
