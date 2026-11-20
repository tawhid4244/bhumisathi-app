"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Live bar chart: khatians per survey. The table under it gives the same numbers as text.
export function SurveyChart({ data }: { data: { survey: string; khatians: number }[] }) {
  return (
    <figure className="mt-3">
      <div className="h-56 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="survey" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="khatians" name="Khatians" fill="#006a4e" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="text-sm text-ink-soft">
        Khatians per survey (live): {data.map((d) => `${d.survey} ${d.khatians}`).join(" · ")}. One
        plot&apos;s record is split across all four surveys — the reason citizens cannot check land
        alone.
      </figcaption>
    </figure>
  );
}
