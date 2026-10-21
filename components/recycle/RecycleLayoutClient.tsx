"use client";

import { useEffect } from "react";
import { useRightPanel } from "../../lib/context/RightPanelContext";
import RecycleRightPanel from "./RecycleRightPanel";

interface Props {
  children: React.ReactNode;
}

export default function RecycleLayoutClient({ children }: Props) {
  const { setOverridePanel } = useRightPanel();

  useEffect(() => {
    // Not exact: sub-pages (/recycle/eko-ugostiteli) share the same panel —
    // with exact=true they were left on the loading skeleton.
    setOverridePanel(<RecycleRightPanel />, "/recycle");
    return () => setOverridePanel(null, "/recycle");
  }, [setOverridePanel]);

  return <>{children}</>;
}
