import { createPublicClient } from "../../lib/supabase/public";
import type { Metadata } from "next";
import type { PinnedIssue } from "./MapClient";
import MapWrapper from "./MapWrapper";
import Shell from "../../components/layout/Shell";

export const metadata: Metadata = {
  title: "Мапа на пријави | Подобар Прилеп",
  description:
    "Визуелизација на пријавени проблеми според категорија на мапа на Прилеп",
};

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;

export default async function MapPage() {
  const supabase = createPublicClient();

  // Include issues with a pin AND issues with only a street name (no pin)
  const { data: issues } = await supabase
    .from("issues")
    .select(
      "id, title, category, status, street_name, photo_url, district, lat, lng, created_at, updated_at",
    )
    .or("lat.not.is.null,street_name.not.is.null")
    .order("created_at", { ascending: false });

  return (
    <Shell fullWidth>
      <MapWrapper issues={(issues ?? []) as PinnedIssue[]} />
    </Shell>
  );
}
