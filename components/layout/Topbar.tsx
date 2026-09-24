"use client";

import Link from "@/components/ui/Link";
import { ImagePlus, Menu, Plus, UserCircle2 } from "lucide-react";
import Button from "../ui/Button";
import UserMenu from "../auth/UserMenu";
import NotificationBell from "../auth/NotificationBell";
import AvatarInitials from "../ui/AvatarInitials";
import { toast } from "sonner";
import { useAuth } from "../../lib/hooks/useAuth";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";

const ActionModal = dynamic(() => import("../ui/ActionModal"), { ssr: false });

const ROTATING_WORDS = ["маката", "идејата", "мислата"];

interface Props {
  onOpenMobileMenu?: () => void;
}

export default function Topbar({ onOpenMobileMenu }: Props) {
  const { user, profile, signOut } = useAuth();
  const [actionOpen, setActionOpen] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [typedWord, setTypedWord] = useState(ROTATING_WORDS[0]);
  const [isDeleting, setIsDeleting] = useState(false);
  const lastMenuOpenRef = useRef(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const currentWord = ROTATING_WORDS[wordIndex];
    const typingSpeed = isDeleting ? 60 : 110;
    const pauseOnFullWord = 1300;

    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && typedWord === currentWord) {
      timeout = setTimeout(() => setIsDeleting(true), pauseOnFullWord);
    } else if (isDeleting && typedWord.length === 0) {
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % ROTATING_WORDS.length);
      }, 220);
    } else {
      timeout = setTimeout(() => {
        setTypedWord((prev) =>
          isDeleting
            ? prev.slice(0, -1)
            : currentWord.slice(0, prev.length + 1),
        );
      }, typingSpeed);
    }

    return () => clearTimeout(timeout);
  }, [isDeleting, typedWord, wordIndex]);

  function openMobileMenu() {
    const now = Date.now();
    if (now - lastMenuOpenRef.current < 400) return;
    lastMenuOpenRef.current = now;
    onOpenMobileMenu?.();
  }

  function handleReportClick() {
    if (!user) {
      if (typeof window === "undefined") return;
      const isLocal =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";
      if (isLocal) {
        toast.info("Најавете се за да пријавите проблем");
        return;
      }
      const next = `${pathname ?? "/"}`;
      window.location.assign(`/auth/login?next=${encodeURIComponent(next)}`);
      return;
    }
    // Institution operator accounts only broadcast official posts — skip the
    // citizen chooser modal and take them straight to their agency form.
    if (profile?.agency_id) {
      router.push(`/agency/${profile.agency_id}`);
      return;
    }
    setActionOpen(true);
  }

  return (
    <>
      <header className="col-span-3 z-30 relative flex h-18 items-center justify-between border-b border-[#e4ece8] px-3 lg:px-3.5">
        <Link
          href="/"
          className="ml-1 flex max-w-[60%] items-center gap-3 cursor-pointer lg:ml-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 items-baseline gap-1 text-xl leading-none tracking-tight">
              <span className="h-full min-w-0  font-semibold text-slate-900">
                Мој
              </span>
              <span className="font-semibold text-primary">Прилеп</span>
            </div>
          </div>
        </Link>

        <div className="pointer-events-none absolute left-1/2 hidden w-full lg:max-w-lg xl:max-w-166.75 -translate-x-1/2 px-2 lg:block">
          <div className="pointer-events-auto">
            <button
              type="button"
              onClick={handleReportClick}
              aria-label="Отвори поле за објава"
              className="flex h-12 w-full items-center gap-2.5 rounded-full border border-[#d7dfdc] bg-white px-3 shadow-[0_2px_10px_rgba(15,23,43,0.08)] transition-colors hover:bg-[#f8fafb] hover:shadow-[0_4px_14px_rgba(15,23,43,0.1)]">
              <AvatarInitials
                name={profile?.full_name ?? profile?.username}
                avatarUrl={profile?.avatar_url}
                className="h-8 w-8 border border-white/70"
                membershipTier={
                  profile?.membership_tier as import("../ui/AvatarInitials").MembershipTier
                }
                points={profile?.points}
              />
              <span className="flex h-8  flex-1 items-center rounded-full bg-[#e2e5e9] px-3.5 text-left text-xs text-slate-500">
                <span className="truncate text-[15px]">
                  Кажи си ја {typedWord}
                  <span className="ml-0.5 inline-block h-[0.95em] w-px animate-pulse bg-slate-400 align-[-0.12em]" />
                </span>
              </span>
              <ImagePlus className="h-4.5 w-4.5 shrink-0 text-[#f43f5e]" />
              <span className="topbar-report-cta inline-flex h-8 shrink-0 items-center rounded-full px-3 text-xs font-semibold text-white">
                Пријави +
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 lg:hidden">
            {user && (
              <NotificationBell
                userId={user.id}
                buttonClassName="h-10 w-10"
                iconSize={20}
              />
            )}
            {user ? (
              <Link
                href="/account"
                aria-label="Мој профил"
                className="flex h-10 w-10 items-center justify-center [-webkit-tap-highlight-color:transparent]">
                <AvatarInitials
                  name={profile?.full_name ?? profile?.username}
                  avatarUrl={profile?.avatar_url}
                  size="sm"
                />
              </Link>
            ) : (
              <Link
                href="/auth/login"
                aria-label="Најава"
                className="flex h-10 w-10 items-center justify-center text-slate-700">
                <UserCircle2 size={22} strokeWidth={2} />
              </Link>
            )}
            <button
              onTouchEnd={(e) => {
                e.preventDefault();
                openMobileMenu();
              }}
              onClick={openMobileMenu}
              data-tour="menu"
              className="relative  flex h-10 w-7 items-center justify-end text-slate-800 z-50"
              aria-label="Отвори мени">
              <Menu size={22} strokeWidth={2.4} />
            </button>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {user ? (
              <>
                <NotificationBell userId={user.id} />
                <UserMenu profile={profile} onSignOut={signOut} />
              </>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">
                    Најава
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {!pathname?.startsWith("/sponsors") && (
        <button
          type="button"
          onClick={handleReportClick}
          className="topbar-report-cta fixed bottom-5 right-4 z-50 inline-flex h-13 w-13 items-center justify-center rounded-full text-white transition-all lg:hidden"
          aria-label="Учествувај">
          <Plus size={22} strokeWidth={2.5} />
        </button>
      )}

      {actionOpen && (
        <ActionModal
          userId={user?.id}
          userEmail={user?.email}
          userName={profile?.full_name ?? user?.user_metadata?.full_name}
          agencyId={profile?.agency_id ?? null}
          onClose={() => setActionOpen(false)}
        />
      )}
    </>
  );
}
