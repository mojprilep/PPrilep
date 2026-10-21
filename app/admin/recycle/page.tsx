import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Shell from "../../../components/layout/Shell";
import RecycleAdmin from "../../../components/admin/RecycleAdmin";
import { fetchGreenVenues } from "../../actions/recycle";

export const metadata = { title: "Еко угостители — Админ", robots: { index: false } };

export default async function RecycleAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/recycle");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/");

  const venues = await fetchGreenVenues();

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
        <div>
          <h1 className="text-base font-semibold">🌿 Еко угостители — Администрација</h1>
          <p className="text-xs text-zinc-500">
            Објектите што селектираат со Пакомак, од нивната табела. Се прикажуваат на /recycle/eko-ugostiteli.
          </p>
        </div>
        {venues.error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {venues.error} (дали е пуштена add_green_venues.sql?)
          </p>
        )}
        <RecycleAdmin initialVenues={venues.data ?? []} />
      </div>
    </Shell>
  );
}
