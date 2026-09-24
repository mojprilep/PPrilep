import Link from "@/components/ui/Link";
import { createClient } from "../../../lib/supabase/server";
import { redirect } from "next/navigation";
import Shell from "../../../components/layout/Shell";
import WaterFeedAdmin from "../../../components/admin/WaterFeedAdmin";

export default async function WaterAdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/water");

  // Only allow the designated admin email
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail && user.email !== adminEmail) redirect("/");

  const { data: posts } = await supabase
    .from("utility_posts")
    .select("id, title, body, status, posted_at")
    .eq("provider", "water")
    .order("posted_at", { ascending: false });

  return (
    <Shell>
      <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-4">
        <div>
          <h1 className="text-base font-semibold">💧 Водовод — Администрација</h1>
          <p className="text-xs text-zinc-500">
            Објавите се прикажуваат веднаш на{" "}
            <Link href="/utility/water" className="text-primary hover:underline">
              страницата на Водовод
            </Link>
          </p>
        </div>
        <WaterFeedAdmin initial={(posts ?? []) as Parameters<typeof WaterFeedAdmin>[0]["initial"]} />
      </div>
    </Shell>
  );
}
