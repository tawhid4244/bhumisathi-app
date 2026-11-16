import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { T } from "@/components/i18n/LangProvider";
import { TrackForm } from "@/components/services/TrackForm";

export const metadata: Metadata = { title: "আবেদনের অবস্থা" };

// Public tracker: no account needed. Shows the status only — never names or land details.
export default function TrackPage() {
  return (
    <>
      <PageHeader
        titleBn="আবেদনের অবস্থা দেখুন"
        titleEn="Track an application"
        subtitleBn="আবেদন নম্বর দিন — লগইন ছাড়াই অবস্থা জানুন।"
        subtitleEn="Enter the application number — see its status without signing in."
      />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <TrackForm />
        <p className="mt-6 text-sm text-ink-soft">
          <T
            bn="গোপনীয়তার জন্য এখানে নাম বা জমির তথ্য দেখানো হয় না। পুরো তথ্য দেখতে ‘আমার সেবা’-তে লগইন করুন।"
            en="For privacy no names or land details are shown here. Sign in to ‘My services’ for the full details."
          />
        </p>
      </main>
    </>
  );
}
