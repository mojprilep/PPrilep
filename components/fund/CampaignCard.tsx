import ProgressBar from "../ui/ProgressBar";
import Link from "@/components/ui/Link";
import type { FundCampaign } from "../../lib/types/database";
import { districtColor, cn, DISTRICT_LABELS } from "../../lib/utils";
import type { District } from "../../lib/types/database";

const STATUS_MK: Record<string, string> = {
  active: "Активна",
  completed: "Завршена",
  cancelled: "Откажана",
};

export default function CampaignCard({ campaign }: { campaign: FundCampaign }) {
  const pct = Math.min(
    100,
    Math.round((campaign.raised_amount / campaign.goal_amount) * 100),
  );

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">
            <Link href={`/fund/${campaign.id}`} className="hover:underline">
              {campaign.title}
            </Link>
          </h3>
          {campaign.description && (
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
              {campaign.description}
            </p>
          )}
        </div>
        {campaign.district && (
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0",
              districtColor(campaign.district as District),
            )}>
            {DISTRICT_LABELS[campaign.district] ?? campaign.district}
          </span>
        )}
      </div>

      <div>
        <ProgressBar
          value={campaign.raised_amount}
          max={campaign.goal_amount}
        />
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-semibold">
            {campaign.raised_amount.toLocaleString()} ден.
          </span>
          <span className="text-xs text-zinc-400">
            од {campaign.goal_amount.toLocaleString()} ден. · {pct}%
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-[10px] px-1.5 py-0.5 rounded font-medium",
            campaign.status === "active" && "bg-black text-white",
            campaign.status === "completed" && "border border-black text-black",
            campaign.status === "cancelled" &&
              "border border-zinc-300 text-zinc-400",
          )}>
          {STATUS_MK[campaign.status] ?? campaign.status}
        </span>
        {campaign.profiles && (
          <span className="text-xs text-zinc-400">
            од {campaign.profiles.full_name}
          </span>
        )}
      </div>
    </div>
  );
}
