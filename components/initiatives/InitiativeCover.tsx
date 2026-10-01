"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Maximize2 } from "lucide-react";
import GalleryLightbox from "../ui/GalleryLightbox";

/**
 * Cover banner that crops to fill, but opens the whole photo uncropped on
 * click. The lightbox is portalled to <body> so a transformed/scrolling
 * parent (the detail modal) can't clip its fixed overlay.
 */
export default function InitiativeCover({
  src,
  className,
  children,
}: {
  src: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Escape should close only the lightbox, not the detail modal underneath
  // (which listens on document). Capture on window runs before both.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Отвори ја сликата"
        className={`group block cursor-zoom-in ${className ?? ""}`}
      >
        {children}
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/50 p-1.5 text-white opacity-80 transition group-hover:opacity-100">
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>
      {open &&
        createPortal(
          <GalleryLightbox images={[src]} startIndex={0} onClose={() => setOpen(false)} onIndexChange={noop} />,
          document.body,
        )}
    </>
  );
}

function noop() {}
