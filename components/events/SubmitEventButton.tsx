"use client";

import Link from "@/components/ui/Link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useAuthContext } from "../../lib/context/AuthContext";
import SubmitEventModal from "./SubmitEventModal";

/**
 * Entry point for citizen event submissions — a compact button placed in the
 * /events header. Logged-in users open the wizard; guests are pointed at the
 * account page to sign in first (same gate as the Позитива submit CTA).
 */
export default function SubmitEventButton() {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);

  const cls =
    "inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary/90";

  return (
    <>
      {user ? (
        <button onClick={() => setOpen(true)} className={cls}>
          <Plus size={14} /> Пријави настан
        </button>
      ) : (
        <Link href="/account" className={cls}>
          <Plus size={14} /> Пријави настан
        </Link>
      )}

      {open && (
        <SubmitEventModal
          userEmail={user?.email}
          userName={user?.user_metadata?.full_name}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
