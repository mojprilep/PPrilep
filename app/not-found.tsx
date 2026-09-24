import Link from "@/components/ui/Link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f2f4f7] px-4 text-center">
      <div className="text-6xl font-bold tracking-tight text-slate-200">404</div>
      <div>
        <h1 className="text-xl font-semibold text-slate-800">
          Страницата не е пронајдена
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Содржината што ја барате не постои или е преместена.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90">
        Назад на почетна
      </Link>
    </div>
  );
}
