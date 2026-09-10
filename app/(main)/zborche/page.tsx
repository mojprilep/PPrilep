import type { Metadata } from "next";

import ZborcheGame from "../../../components/zborche/ZborcheGame";

export const metadata: Metadata = {
  title: "ЗборЧе | Мој Прилеп",
  description:
    "Погоди го македонскиот збор на денот. Нова загатка секој ден — играј ЗборЧе на Мој Прилеп.",
};

// The board itself is a client component that fetches today's word live, so the
// page is a thin static shell — no revalidate needed here.
export default function ZborchePage() {
  return (
    <div className="mx-auto max-w-lg py-2">
      <ZborcheGame />
    </div>
  );
}
