"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { detectPlatform, type MobilePlatform } from "../../lib/config/appStores";

const DISMISS_KEY = "install-banner-collapsed";

/**
 * Mobile-only install prompt anchored to the BOTTOM. It slides up softly as a
 * floating card. The X dismisses it for the session — it slides all the way
 * down and out, leaving nothing behind (no handle, no border).
 */
export default function InstallAppBanner() {
  const [platform, setPlatform] = useState<MobilePlatform>("other");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Never show inside the native WebView.
    if (/mojprilep/i.test(navigator.userAgent)) return;

    setPlatform(detectPlatform(navigator.userAgent));
    setMounted(true);

    // If collapsed earlier this session, stay collapsed; otherwise slide open
    // on the next tick so the animation plays.
    const collapsed = sessionStorage.getItem(DISMISS_KEY) === "1";
    if (!collapsed) {
      const id = window.setTimeout(() => setOpen(true), 350);
      return () => window.clearTimeout(id);
    }
  }, []);

  if (!mounted) return null;

  const label =
    platform === "ios"
      ? "Преземи на App Store"
      : platform === "android"
        ? "Преземи на Google Play"
        : "Преземи ја апликацијата";

  function collapse() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:hidden"
      style={{ pointerEvents: open ? "auto" : "none" }}>
      <div
        className="transition-all duration-500 ease-out will-change-transform"
        style={{
          transform: open ? "translateY(0)" : "translateY(calc(100% + 24px))",
          opacity: open ? 1 : 0,
        }}>
        {/* Floating card */}
        <div className="rounded-2xl bg-theme-surface px-4 py-4 shadow-xl">
          <div className="flex items-center gap-3">
            <Image
              src="/logo/app-icon-192.png"
              alt="Мој Прилеп"
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-2xl"
            />
            <a
              href="/app"
              onClick={collapse}
              className="flex h-14 flex-1 items-center justify-center rounded-2xl bg-primary px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              {label}
            </a>
            <button
              type="button"
              onClick={collapse}
              aria-label="Затвори"
              className="-mr-1 shrink-0 rounded-full p-1 text-theme-muted hover:bg-theme-surface-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
