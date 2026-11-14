import type { MouzaOption } from "@/lib/engines/mouzas";

interface Props {
  mouzas: MouzaOption[];
  mouza?: string;
  by?: "dag" | "khatian";
  no?: string;
}

// Plain HTML GET form: works without JavaScript and puts the search in the URL,
// so a report link can be shared or opened from another page.
export function SearchForm({ mouzas, mouza, by = "dag", no }: Props) {
  return (
    <form
      method="get"
      action="/check"
      className="rounded-xl border border-line bg-card p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1 text-sm font-medium">
          মৌজা <span className="sr-only">Mouza</span>
          <select
            name="mouza"
            defaultValue={mouza ?? mouzas[0]?.code.toLowerCase()}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          >
            {mouzas.map((m) => (
              <option key={m.code} value={m.code.toLowerCase()}>
                {m.name_bn} (জেএল {m.jl_no.toLocaleString("bn-BD")})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          কী দিয়ে খুঁজবেন <span className="sr-only">Search by</span>
          <select
            name="by"
            defaultValue={by}
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          >
            <option value="dag">দাগ নম্বর</option>
            <option value="khatian">খতিয়ান নম্বর (বিএস)</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          নম্বর <span className="sr-only">Number</span>
          <input
            name="no"
            defaultValue={no}
            required
            inputMode="numeric"
            pattern="[0-9০-৯]{1,5}"
            placeholder="যেমন ১৪৫"
            className="min-h-11 rounded-lg border border-line bg-white px-3 text-base"
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-brand px-5 font-semibold text-white hover:bg-brand/90"
        >
          যাচাই করুন
        </button>
      </div>
      <p lang="en" className="mt-2 text-xs text-ink-soft">
        Choose a mouza, then enter a dag or BS khatian number. Bangla or English digits both work.
      </p>
    </form>
  );
}
