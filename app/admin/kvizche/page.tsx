import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import Shell from "../../../components/layout/Shell";
import KvizcheAdmin from "../../../components/admin/KvizcheAdmin";
import { fetchAdminKvizche } from "../../actions/kvizche";

export const metadata = { title: "КвизЧе — Админ", robots: { index: false } };

export default async function KvizcheAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/kvizche");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_admin) redirect("/");

  const weeks = await fetchAdminKvizche();

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
        <div>
          <h1 className="text-base font-semibold">🏛️ КвизЧе — Администрација</h1>
          <p className="text-xs text-zinc-500">
            Една тема неделно, едно прашање дневно. Пон 2 одговори · Вто 2 · Сре 3 · Чет 4 · Пет 5 · Саб 5 ·
            Нед хронологија. Јавната страница е /kvizche.
          </p>
        </div>
        {weeks.error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {weeks.error} (дали е пуштена add_kvizche.sql?)
          </p>
        )}
        <KvizcheAdmin weeks={weeks.data ?? []} />
      </div>
    </Shell>
  );
}
