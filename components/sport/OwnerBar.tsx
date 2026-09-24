"use client";

/**
 * "Уреди го профилот" — shown only to the account bound to this club.
 *
 * A client component on purpose: the profile page is cached for an hour and
 * shared by everyone, so who is looking cannot be part of that HTML. This asks
 * afterwards and renders nothing for the 99% who are just reading.
 */

import { useEffect, useState } from "react";
import Link from "@/components/ui/Link";
import { Megaphone, Pencil } from "lucide-react";

export default function OwnerBar({ slug }: { slug: string }) {
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/sport/mine")
      .then((r) => r.json())
      .then((d) => {
        if (alive) setCanEdit(d.isAdmin === true || d.club?.slug === slug);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [slug]);

  if (!canEdit) return null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/sport/${slug}/uredi#novosti`}
        className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
      >
        <Megaphone className="h-3.5 w-3.5" />
        Нова објава
      </Link>
      <Link
        href={`/sport/${slug}/uredi`}
        className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700"
      >
        <Pencil className="h-3.5 w-3.5" />
        Уреди го профилот
      </Link>
    </div>
  );
}
