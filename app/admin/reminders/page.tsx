import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { createAdminClient } from "../../../lib/supabase/admin";
import Shell from "../../../components/layout/Shell";
import { fetchCityEvents } from "@/lib/sanity/queries";
import EventReminderAdmin, {
  type ReminderEvent,
} from "../../../components/admin/EventReminderAdmin";
import ZborcheBroadcastAdmin from "../../../components/admin/ZborcheBroadcastAdmin";
import { OWNER_EMAIL } from "../../../lib/config/owner";

export const dynamic = "force-dynamic";

// Local Europe/Skopje YYYY-MM-DD for an offset in days from today.
function skopjeDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Skopje",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export default async function RemindersAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/admin/reminders");

  // Gate to the site admin (profiles.is_admin or ADMIN_EMAIL).
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin =
    Boolean(profile?.is_admin) ||
    user.email === OWNER_EMAIL ||
    (!!process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL);
  if (!isAdmin) redirect("/");

  const today = skopjeDate(0);
  const tomorrow = skopjeDate(1);

  const events = await fetchCityEvents();
  const reminderEvents: ReminderEvent[] = events
    .filter((ev) => ev.startDate === today || ev.startDate === tomorrow)
    .map((ev) => ({
      _id: ev._id,
      title: ev.title,
      time: ev.time,
      location: ev.location,
      when: ev.startDate === today ? "today" : "tomorrow",
    }));

  return (
    <Shell>
      <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-4">
        <div>
          <h1 className="text-base font-semibold">📅 Потсетници за настани</h1>
          <p className="text-xs text-zinc-500">
            Испрати рачен потсетник до сите уреди со вклучени известувања за
            настани денес или утре. Автоматскиот потсетник (за оние што стиснале
            „Потсети ме“) се испраќа сам ~3 часа пред почетокот.
          </p>
        </div>
        <EventReminderAdmin events={reminderEvents} />

        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
            🟩 ЗборЧе
          </h2>
          <ZborcheBroadcastAdmin />
        </section>
      </div>
    </Shell>
  );
}
