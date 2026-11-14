import { Fragment, type ReactNode } from "react";

// Renders the small amount of formatting the model uses (**bold**, bullet and numbered lists,
// line breaks) as React elements. No HTML from the model is ever injected into the page.

function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

const BULLET = /^\s*(?:[-*•]|[0-9০-৯]+[.)।])\s+/;

export function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-1 list-disc space-y-0.5 pl-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of lines) {
    if (BULLET.test(line)) {
      list.push(line.replace(BULLET, ""));
      continue;
    }
    flush();
    const t = line.trim();
    if (!t || /^-{3,}$/.test(t)) continue;
    blocks.push(
      <p key={`p${blocks.length}`} className="my-1">
        {inline(t.replace(/^\*(.*)\*$/, "$1"))}
      </p>,
    );
  }
  flush();
  return <>{blocks}</>;
}
