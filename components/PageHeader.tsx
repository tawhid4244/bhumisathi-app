import Link from "next/link";
import { T } from "./i18n/LangProvider";

interface Props {
  titleBn: string;
  titleEn: string;
  subtitleBn?: string;
  subtitleEn?: string;
}

// Title band at the top of every inner page: breadcrumb, title and one line on what the page does.
export function PageHeader({ titleBn, titleEn, subtitleBn, subtitleEn }: Props) {
  return (
    <div className="bg-alpana px-4 pb-7 pt-4 text-white">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="অবস্থান / Breadcrumb" className="text-sm text-white/80">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center underline-offset-4 hover:underline"
          >
            <T bn="হোম" en="Home" />
          </Link>
          <span aria-hidden="true" className="mx-2">
            ›
          </span>
          <span aria-current="page">
            <T bn={titleBn} en={titleEn} />
          </span>
        </nav>
        <h1 className="animate-fade-up text-2xl font-bold leading-tight sm:text-3xl">
          <T bn={titleBn} en={titleEn} />
        </h1>
        {subtitleBn ? (
          <p className="animate-fade-up mt-2 max-w-3xl text-white/90 [animation-delay:80ms]">
            <T bn={subtitleBn} en={subtitleEn ?? titleEn} />
          </p>
        ) : null}
      </div>
    </div>
  );
}
