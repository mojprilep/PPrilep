"use client";

import { useSearchParams } from "next/navigation";
import IssueList from "../../../components/issues/IssueList";
import type { District } from "../../../lib/types/database";

const DISTRICTS: District[] = [
  "Center",
  "Varoš",
  "Trizla",
  "Točila",
  "Rid",
  "Tipski",
  "Boncejca",
];

/**
 * Reads `?district=` on the client so the /issues page itself stays static.
 * Awaiting `searchParams` on the server made every visit render per request.
 */
export default function IssuesByDistrict() {
  const district = useSearchParams().get("district");
  const defaultDistrict = DISTRICTS.includes(district as District)
    ? (district as District)
    : undefined;

  return (
    <IssueList key={defaultDistrict ?? "all"} defaultDistrict={defaultDistrict} />
  );
}
