import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/auth/guard";
import { DEMO_USERS } from "@/lib/auth/demo-accounts";
import { Bi, T } from "@/components/i18n/LangProvider";

const ROLE_LABEL = {
  citizen: { bn: "নাগরিক", en: "Citizen" },
  officer: { bn: "কর্মকর্তা", en: "Officer" },
  admin: { bn: "প্রশাসক", en: "Admin" },
} as const;

export const metadata: Metadata = { title: "লগইন" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <PageHeader titleBn="লগইন" titleEn="Sign in" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-card" />}>
          <Form searchParams={props.searchParams} />
        </Suspense>
        <section className="mt-8 rounded-xl border border-line bg-card p-4 text-sm">
          <h2 className="font-semibold">
            <Bi bn="ডেমো অ্যাকাউন্ট (কাল্পনিক)" en="Demo accounts (synthetic)" />
          </h2>
          <p className="mt-1 text-ink-soft">
            <T
              bn="প্রতিটি ভূমিকার জন্য একটি অ্যাকাউন্ট। পাসওয়ার্ড ডেমো পরিচালকের কাছ থেকে নিন।"
              en="One account per role. Ask the demo host for the password."
            />
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_USERS.map((u) => (
              <li key={u.email} className="flex flex-wrap gap-x-2">
                <span className="font-medium">
                  <T bn={ROLE_LABEL[u.role].bn} en={ROLE_LABEL[u.role].en} />
                </span>
                <span lang="en" className="break-all font-mono text-xs leading-6">
                  {u.email}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const error = typeof params.error === "string" ? params.error.slice(0, 20) : undefined;
  return <LoginForm next={next} initialError={error} />;
}
