"use client";

/**
 * "Пријави го твојот клуб" — the deep-link route for the submission wizard.
 *
 * The primary entry points (the directory invite card and the right-panel
 * link) open the same wizard in a popup via SubmitClubButton. This route keeps
 * a full-page home for the very same ClubSubmitForm, so a shared /sport/nov URL
 * still works and both surfaces stay one implementation.
 */

import { useRouter } from "next/navigation";
import Link from "@/components/ui/Link";

import { useAuth } from "../../../../lib/hooks/useAuth";
import ClubSubmitForm from "../../../../components/sport/ClubSubmitForm";

export default function NewSportClubPage() {
  const { user } = useAuth();
  const router = useRouter();

  // ── Signed out ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="space-y-4 px-1 py-8 text-center">
        <h1 className="text-base font-bold text-zinc-900">Пријави го твојот клуб</h1>
        <p className="text-sm text-zinc-500">
          Мора да си најавен за да пратиш профил — така знаеме со кого да
          контактираме ако нешто треба да се дополни.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white"
        >
          Најави се
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <ClubSubmitForm
        onCancel={() => router.push("/sport")}
        onClose={() => router.push("/sport")}
      />
    </div>
  );
}
