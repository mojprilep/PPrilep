import { createPublicClient } from "@/lib/supabase/public";
import CampaignCard from "@/components/fund/CampaignCard";
import { notFound } from "next/navigation";

// Public data only (cookie-free client), so the page can be cached.
export const revalidate = 60;
// Empty = render each path on first visit, then cache it (runtime ISR).
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FundCampaignDetailPage({ params }: Props) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isInteger(campaignId)) notFound();

  const supabase = createPublicClient();
  const { data: campaign } = await supabase
    .from("fund_campaigns")
    .select("*, profiles(id, full_name, username)")
    .eq("id", campaignId)
    .single();

  if (!campaign) notFound();

  return (
      <div className="space-y-4">
        <CampaignCard campaign={campaign} />

        {campaign.description && (
          <section className="rounded-xl border border-zinc-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-zinc-900">Детали</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
              {campaign.description}
            </p>
          </section>
        )}
      </div>
  );
}
