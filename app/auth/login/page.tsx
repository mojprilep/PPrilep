import Link from "@/components/ui/Link";
import { Suspense } from "react";
import LoginForm from "../../../components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="w-full max-w-md">
      {/* Mobile logo (brand panel is hidden < lg) */}
      <div className="mb-6 flex flex-col items-center gap-2 lg:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-white.svg" alt="" className="h-12 w-auto" />
        <span className="text-lg font-extrabold tracking-tight text-white">
          Мој Прилеп
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-xl shadow-zinc-200/40 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-theme-heading">
            Добредојде назад
          </h1>
          <p className="mt-1 text-sm text-theme-muted">
            Најави се на твојата сметка
          </p>
        </div>

        <Suspense>
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-theme-muted">
          Немаш сметка?{" "}
          <Link
            href="/auth/register"
            className="font-semibold text-primary hover:underline">
            Регистрирај се
          </Link>
        </p>
      </div>
    </div>
  );
}
