import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MapTabs } from "@/components/map/MapTabs";
import { MouzaMap } from "@/components/map/MouzaMap";
import { UploadMeasure } from "@/components/map/UploadMeasure";
import { currentUser } from "@/lib/auth/current";
import { runTool } from "@/lib/tools/registry";
import { loadMouzaMap, type MapAreaResult } from "@/lib/engines/map";

export const metadata: Metadata = { title: "মৌজা ম্যাপে মাপ" };

export default function MapPage(props: PageProps<"/map">) {
  return (
    <>
      <PageHeader
        titleBn="মৌজা ম্যাপে মাপ"
        titleEn="Mouza map area: tap a dag, or measure on your own map photo"
        subtitleBn="দাগের মাপ শতক, কাঠা, বিঘা ও একরে — খতিয়ানের সাথে মিলিয়ে।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Suspense fallback={<p className="text-ink-soft">লোড হচ্ছে… Loading…</p>}>
          <Content searchParams={props.searchParams} />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/map">, "searchParams">) {
  await connection();
  const map = await loadMouzaMap("Nayapara");
  // Opened from a report or chat with ?dag=145: show that dag straight away.
  const dag = Number((await searchParams).dag);
  let initial: MapAreaResult | null = null;
  if (Number.isInteger(dag) && map.dags.some((d) => d.dag_no === dag)) {
    // Through the tool, so the view goes into the audit log ("who checked my land").
    initial = (await runTool("map_area", { mouza: map.mouza_en, dag_no: dag }, { user: await currentUser() })) as MapAreaResult; // prettier-ignore
  }
  return <MapTabs mouzaMap={<MouzaMap map={map} initial={initial} />} upload={<UploadMeasure />} />;
}
