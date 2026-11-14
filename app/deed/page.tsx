import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DeedReader } from "@/components/deed/DeedReader";

export const metadata: Metadata = { title: "দলিল পড়ুন" };

export default function DeedPage() {
  return (
    <>
      <PageHeader
        titleBn="দলিল পড়ুন"
        titleEn="Deed reader: photo → plain Bangla → checked against the records"
        subtitleBn="দলিলের ছবি দিন — সাথী সহজ বাংলায় বুঝিয়ে দেবে এবং খতিয়ান ও মৌজা ম্যাপের সাথে মিলিয়ে দেখবে।"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <DeedReader />
      </main>
      <SiteFooter />
    </>
  );
}
