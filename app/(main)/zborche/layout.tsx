"use client";

import { useEffect } from "react";
import { useRightPanel } from "../../../lib/context/RightPanelContext";
import ZborcheRightPanel from "../../../components/zborche/ZborcheRightPanel";

export default function ZborcheLayout({ children }: { children: React.ReactNode }) {
  const { setOverridePanel } = useRightPanel();

  useEffect(() => {
    setOverridePanel(<ZborcheRightPanel />, "/zborche", true);
    return () => setOverridePanel(null, "/zborche");
  }, [setOverridePanel]);

  return <>{children}</>;
}
