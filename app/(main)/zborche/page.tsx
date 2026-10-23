import type { Metadata } from "next";

import GameIntro from "../../../components/games/GameIntro";
import ZborcheGame from "../../../components/zborche/ZborcheGame";
import ZborcheLogo from "../../../components/zborche/ZborcheLogo";

export const metadata: Metadata = {
  title: "ЗборЧе | Мој Прилеп",
  description:
    "Погоди го македонскиот збор на денот. Нова загатка секој ден — играј ЗборЧе на Мој Прилеп.",
};

// The board itself is a client component that fetches today's word live, so the
// page is a thin static shell — no revalidate needed here.
export default function ZborchePage() {
  return (
    <div className="mx-auto w-full max-w-lg overflow-x-hidden px-3 py-2">
      <GameIntro id="zborche" mark={<ZborcheLogo height={64} />} tagline="Погоди го зборот на денот" />
      <ZborcheGame />
    </div>
  );
}
