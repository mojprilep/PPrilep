"use client";

/**
 * Drop-in for next/link that prefetches on intent instead of on sight.
 *
 * Default <Link> prefetches every link that scrolls into view, 3-4 segment
 * requests each. With the left nav, right panels and cards on every page that
 * came to ~70-100 Vercel edge requests per page view, nearly all for pages the
 * visitor never opened. Here a link prefetches only when hovered or focused
 * (desktop) or touched (phones) — still ahead of the click, but only for the
 * link actually being used. Pass `prefetch` explicitly to opt back into
 * Next's behaviour for a specific link.
 */
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextLink>;

export default function Link({ prefetch, onMouseEnter, onFocus, onTouchStart, ...props }: Props) {
  const router = useRouter();
  if (prefetch !== undefined) {
    return (
      <NextLink
        prefetch={prefetch}
        onMouseEnter={onMouseEnter}
        onFocus={onFocus}
        onTouchStart={onTouchStart}
        {...props}
      />
    );
  }
  const href = typeof props.href === "string" ? props.href : null;
  const warm = () => {
    // Internal string hrefs only; external links and UrlObjects just navigate.
    if (href?.startsWith("/")) router.prefetch(href);
  };
  return (
    <NextLink
      prefetch={false}
      onMouseEnter={(e) => {
        warm();
        onMouseEnter?.(e);
      }}
      onFocus={(e) => {
        warm();
        onFocus?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
      {...props}
    />
  );
}
