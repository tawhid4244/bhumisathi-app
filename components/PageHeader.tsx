import Link from "next/link";

interface Props {
  titleBn: string;
  titleEn: string;
  subtitleBn?: string;
}

// Top of every inner page: back to home, Bangla title, English title underneath.
export function PageHeader({ titleBn, titleEn, subtitleBn }: Props) {
  return (
    <header className="bg-ink px-4 pb-5 pt-4 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm text-white/85 underline-offset-4 hover:underline"
        >
          ← হোম <span className="ml-1 text-white/60">Home</span>
        </Link>
        <h1 className="text-2xl font-bold leading-tight">{titleBn}</h1>
        <p lang="en" className="text-sm text-white/75">
          {titleEn}
        </p>
        {subtitleBn ? <p className="mt-2 text-white/90">{subtitleBn}</p> : null}
      </div>
    </header>
  );
}
