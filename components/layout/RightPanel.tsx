"use client";

import ZborcheCard from "../zborche/ZborcheCard";
import EventSpotlight from "../ui/EventSpotlight";
import PublicSponsorPanel from "../ui/PublicSponsorPanel";
import MobileAppPanel from "../app/MobileAppPanel";

/**
 * Default right panel for routes without a custom one (home, issues, heroes,
 * communities): the ЗборЧе daily-game teaser, the featured/next city event,
 * then the real sponsors panel (current partners + apply button).
 */
export default function RightPanel() {
  return (
    <aside className="flex h-auto flex-col gap-3 overflow-y-auto bg-transparent text-sm lg:gap-0 xl:text-base">
      <MobileAppPanel />
      <ZborcheCard />
      <EventSpotlight />
      <PublicSponsorPanel />

      {/* The legal links used to sit here as well as on /about. One canonical
          place is enough, and the panel reads as a sidebar, not a footer. */}
      <div className="mt-6 px-1 pb-8 text-xs text-zinc-400">
        &copy; {new Date().getFullYear()} Мој Прилеп
      </div>
    </aside>
  );
}
