import Link from "next/link";
import { SiteFooter } from "./SiteFooter";

interface Props {
  titleBn: string;
  titleEn: string;
  task: number;
}

// Placeholder used by pages that later tasks fill in. Says plainly which task builds it.
export function ComingSoon({ titleBn, titleEn, task }: Props) {
  return (
    <>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-brand underline-offset-4 hover:underline"
        >
          ← হোম{" "}
          <span lang="en" className="ml-1 text-ink-soft">
            Home
          </span>
        </Link>
        <h1 className="mt-4 text-2xl font-bold">{titleBn}</h1>
        <p lang="en" className="text-ink-soft">
          {titleEn}
        </p>
        <div className="mt-6 rounded-xl border border-line bg-card p-5">
          <p className="font-medium">এই পাতাটি শীঘ্রই আসছে।</p>
          <p lang="en" className="text-sm text-ink-soft">
            Coming soon: built in task {task} of the plan.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
