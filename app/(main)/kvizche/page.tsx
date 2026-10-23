import type { Metadata } from "next";

import GameIntro from "../../../components/games/GameIntro";
import KvizcheGame from "../../../components/kvizche/KvizcheGame";
import KvizcheLogo from "../../../components/kvizche/KvizcheLogo";

export const metadata: Metadata = {
  title: "КвизЧе | Мој Прилеп",
  description:
    "Неделен квиз за историјата на Прилеп и Македонија — едно прашање секој ден, секоја недела нова тема.",
};

// The quiz is a client component that loads the week live from /api/kvizche,
// so the page is a thin static shell — no revalidate needed here.
export default function KvizchePage() {
  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-3 py-2">
      <GameIntro id="kvizche" mark={<KvizcheLogo height={56} />} tagline="Едно прашање од историјата, секој ден" />
      <KvizcheGame />
    </div>
  );
}
