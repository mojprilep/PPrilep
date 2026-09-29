"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  detectPlatform,
  type MobilePlatform,
} from "../../lib/config/appStores";
import { ANDROID_PACKAGE, isAppLinkPath } from "../../lib/config/appLinks";

const DISMISS_KEY = "install-banner-collapsed";

/**
 * Query flag on the iOS "open in app" link. iOS only hands a link to the app
 * when it points at a DIFFERENT host than the page it's tapped on, so the
 * button targets the apex (we're on www). If the app is installed, iOS opens
 * it and this page never loads again; if it isn't, the apex redirects back
 * here carrying the flag — which is how we know to send the visitor to the
 * App Store instead.
 */
const IOS_FALLBACK_PARAM = "app";

/**
 * Link that opens the current page in the app, or null when the app has no
 * screen for it (then the button just goes to the store).
 */
function openInAppHref(platform: MobilePlatform, pathname: string): string | null {
  if (platform === "other" || !isAppLinkPath(pathname)) return null;
  const { search, hash } = window.location;

  if (platform === "ios") {
    const params = new URLSearchParams(search);
    params.set(IOS_FALLBACK_PARAM, "1");
    return `https://mojprilep.mk${pathname}?${params}${hash}`;
  }

  // Android: Chrome/Samsung open the app directly from an intent: URL and fall
  // back to the Play listing when it isn't installed.
  const fallback = encodeURIComponent(PLAY_STORE_URL);
  return `intent://www.mojprilep.mk${pathname}${search}#Intent;scheme=https;package=${ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/**
 * Mobile-only install prompt anchored to the BOTTOM. It slides up softly as a
 * floating card. The X dismisses it for the session — it slides all the way
 * down and out, leaving nothing behind (no handle, no border).
 */
export default function InstallAppBanner() {
  const [platform, setPlatform] = useState<MobilePlatform>("other");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // Never show inside the native WebView.
    if (/mojprilep/i.test(navigator.userAgent)) return;

    const detected = detectPlatform(navigator.userAgent);

    // Came back from the iOS "open in app" link → the app isn't installed (or
    // this browser can't hand off, e.g. Facebook's). Drop the flag so the URL
    // stays clean if shared, then go to the store.
    const url = new URL(window.location.href);
    if (url.searchParams.has(IOS_FALLBACK_PARAM)) {
      url.searchParams.delete(IOS_FALLBACK_PARAM);
      window.history.replaceState(window.history.state, "", url);
      if (detected === "ios") {
        window.location.href = APP_STORE_URL;
        return;
      }
    }

    setPlatform(detected);
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

  const appHref = openInAppHref(platform, pathname);
  const label = appHref
    ? "Отвори во апликацијата"
    : platform === "ios"
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
              href={appHref ?? "/app"}
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
