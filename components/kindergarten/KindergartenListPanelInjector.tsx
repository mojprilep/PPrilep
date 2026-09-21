"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { useRightPanel } from "../../lib/context/RightPanelContext";
import KindergartenListRightPanel from "./KindergartenListRightPanel";
import type { SignupDocument, MenuPost } from "../../lib/sanity/kindergarten";

interface Props {
  signupDocuments: SignupDocument[];
  latestMenu: MenuPost[];
}

// Receives pre-fetched data from the server layout and injects the panel into
// context via useLayoutEffect — fires before the browser paints, so there is
// no visible flash of the default panel.
export default function KindergartenListPanelInjector({ signupDocuments, latestMenu }: Props) {
  const { setOverridePanel } = useRightPanel();
  const pathname = usePathname();

  useLayoutEffect(() => {
    // Show the section panel on the list itself and on each announcement post,
    // but not on institution ([slug]) pages — those inject their own panel.
    const isList = pathname === "/kindergarten";
    const isAnnouncement = pathname?.startsWith("/kindergarten/announcement/") ?? false;
    if (!isList && !isAnnouncement) return;

    setOverridePanel(
      <KindergartenListRightPanel signupDocuments={signupDocuments} latestMenu={latestMenu} />,
      pathname!,
      true,
    );
    return () => setOverridePanel(null, pathname!);
  }, [pathname, signupDocuments, latestMenu, setOverridePanel]);

  return null;
}
