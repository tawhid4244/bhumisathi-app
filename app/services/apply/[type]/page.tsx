import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { NotAllowed } from "@/components/auth/NotAllowed";
import { ApplyWizard } from "@/components/services/ApplyWizard";
import { ComplaintForm, MutationForm } from "@/components/services/Forms";
import { requirePageRole } from "@/lib/auth/guard";
import { listMouzas } from "@/lib/engines/mouzas";
import { APPLICATION_TYPES, feeFor, type ApplicationTypeId } from "@/lib/services/catalog";

export const metadata: Metadata = { title: "আবেদন" };

export default function ApplyPage({ params }: PageProps<"/services/apply/[type]">) {
  return (
    <Suspense fallback={<p className="p-6 text-ink-soft">লোড হচ্ছে… Loading…</p>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ type: string }> }) {
  await connection();
  const { type } = await params;
  const def = APPLICATION_TYPES[type as ApplicationTypeId];
  if (!def) notFound();
  if (def.id === "land_tax") redirect("/land-tax"); // the tax has its own calculator page
  const { ok } = await requirePageRole("citizen", `/services/apply/${type}`);
  return (
    <>
      <PageHeader
        titleBn={def.bn}
        titleEn={def.en}
        subtitleBn={def.hint_bn}
        subtitleEn={def.hint_en}
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {!ok ? (
          <NotAllowed need="citizen" />
        ) : def.id === "mutation" ? (
          <MutationForm fees={feeFor("mutation", {})} />
        ) : def.id === "complaint" ? (
          <ComplaintForm />
        ) : (
          <ApplyWizard type={def} mouzas={await listMouzas()} />
        )}
      </main>
    </>
  );
}
