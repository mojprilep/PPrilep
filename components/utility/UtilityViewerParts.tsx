"use client";

import type { ReactNode } from "react";
import { useViewer, type Viewer } from "../../lib/useViewer";
import AgencyPostCard from "../agency/AgencyPostCard";
import KomunalecContactForm from "../komunalec/KomunalecContactForm";
import type { AgencyPost } from "../../lib/types/database";

/**
 * The personal bits of the (cached) utility pages, resolved in the browser via
 * useViewer so the page itself never reads cookies. Display-only: every write
 * is still authorised by the server / RLS.
 */

/** Admin or this provider's own operator may manage the announcements. */
function canManage(v: Viewer, agencyId: string) {
  return v.isAdmin || (v.agencyId !== null && v.agencyId === agencyId);
}

/** Renders children only for staff who manage this provider. */
export function ManagedOnly({
  agencyId,
  children,
}: {
  agencyId: string;
  children: ReactNode;
}) {
  const viewer = useViewer();
  return canManage(viewer, agencyId) ? <>{children}</> : null;
}

export function AgencyPostList({
  posts,
  agencyId,
}: {
  posts: AgencyPost[];
  agencyId: string;
}) {
  const viewer = useViewer();
  const manage = canManage(viewer, agencyId);
  return (
    <>
      {posts.map((post) => (
        <AgencyPostCard key={post.id} post={post} canManage={manage} />
      ))}
    </>
  );
}

export function ViewerKomunalecContactForm() {
  const viewer = useViewer();
  return (
    <KomunalecContactForm
      // Remount once the viewer resolves so the name/street pre-fill applies
      // (the form copies its defaults into state on mount).
      key={viewer.userId ?? "guest"}
      loggedIn={!!viewer.userId}
      defaultName={viewer.fullName ?? undefined}
      defaultStreet={viewer.streetName ?? undefined}
    />
  );
}
