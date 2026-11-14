import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LoginForm } from "@/components/auth/LoginForm";
import { safeNext } from "@/lib/auth/guard";
import { DEMO_USERS } from "@/lib/auth/demo-accounts";
import { ROLE_BN } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "লগইন" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <>
      <PageHeader titleBn="লগইন" titleEn="Sign in" />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
        <Suspense fallback={<LoginForm next="/" />}>
          <Form searchParams={props.searchParams} />
        </Suspense>
        <section className="mt-8 rounded-xl border border-line bg-card p-4 text-sm">
          <h2 className="font-semibold">ডেমো অ্যাকাউন্ট (কাল্পনিক) · Demo accounts</h2>
          <p className="mt-1 text-ink-soft">
            প্রতিটি ভূমিকার জন্য একটি অ্যাকাউন্ট। পাসওয়ার্ড ডেমো পরিচালকের কাছ থেকে নিন।
          </p>
          <ul className="mt-2 space-y-1">
            {DEMO_USERS.map((u) => (
              <li key={u.email} className="flex flex-wrap gap-x-2">
                <span className="font-medium">{ROLE_BN[u.role]}</span>
                <span lang="en" className="break-all font-mono text-xs leading-6">
                  {u.email}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  return <LoginForm next={next} />;
}
