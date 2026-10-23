"use client";

import { useEffect } from "react";
import { useRightPanel } from "../../../lib/context/RightPanelContext";
import KvizcheBoard from "../../../components/kvizche/KvizcheBoard";

export default function KvizcheLayout({ children }: { children: React.ReactNode }) {
  const { setOverridePanel } = useRightPanel();

  useEffect(() => {
    setOverridePanel(<KvizcheBoard />, "/kvizche", true);
    return () => setOverridePanel(null, "/kvizche");
  }, [setOverridePanel]);

  return <>{children}</>;
}
