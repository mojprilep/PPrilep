"use client";

import { useState } from "react";
import Link from "@/components/ui/Link";
import { useAuthContext } from "../../lib/context/AuthContext";
import SubmitClubModal from "./SubmitClubModal";

/**
 * Opens the "Пријави клуб" popup wizard for a signed-in user; sends a guest to
 * the account page to sign in first (same gate as the event/story submit CTAs).
 * Style-agnostic — the caller passes the visible trigger via className/children,
 * so both the invite card and the right-panel text link share one behaviour.
 */
export default function SubmitClubButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);

  return (
    <>
      {user ? (
        <button type="button" onClick={() => setOpen(true)} className={className}>
          {children}
        </button>
      ) : (
        <Link href="/account" className={className}>
          {children}
        </Link>
      )}

      {open && <SubmitClubModal onClose={() => setOpen(false)} />}
    </>
  );
}
