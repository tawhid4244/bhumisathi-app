import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { NotAllowed } from "@/components/auth/NotAllowed";
import { RegistryDesk } from "@/components/registry/RegistryDesk";
import { requirePageRole } from "@/lib/auth/guard";
import { listPeople, recentActivity } from "@/lib/engines/demo";
import { listMouzas } from "@/lib/engines/mouzas";

export const metadata: Metadata = { title: "সাব-রেজিস্ট্রি ডেমো" };

export default function RegistryPage() {
  return (
    <>
      <PageHeader
        titleBn="সাব-রেজিস্ট্রি ডেমো"
        titleEn="Sub-registry demo: the check runs before the deed is registered"
        subtitleBn="দলিল নিবন্ধনের আগে সিস্টেম জমি যাচাই ও শেয়ার লেজার দেখে; বিক্রয়যোগ্য না হলে দলিল আটকে দেয়।"
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Desk />
        </Suspense>
      </main>
    </>
  );
}

async function Desk() {
  await connection(); // always read fresh data, never a build-time snapshot
  // Sub-registry officers only: they record sales, bainas and mortgages.
  const { user, ok } = await requirePageRole("officer", "/registry");
  if (!ok) return <NotAllowed need="officer" />;
  const [mouzas, people, activity] = await Promise.all([
    listMouzas(),
    listPeople(),
    recentActivity(),
  ]);
  return (
    <RegistryDesk
      mouzas={mouzas}
      people={people}
      initialActivity={activity}
      canReset={user.role === "admin"}
    />
  );
}
