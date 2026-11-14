import { ownerNames } from "../engines/ledger";
import { bn } from "../engines/rules";
import { describeAction } from "./agent";

// Read-back for a pending write action, with real (synthetic) owner names instead of ids.
// Example: "বায়না নিবন্ধন: Nayapara দাগ ১৪৫, বিক্রেতা মোঃ রহিম উদ্দিন → সালমা আক্তার, ১০ শতক, ৯০ দিন। ঠিক আছে?"
export async function describeWithNames(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const ids = [input.seller_id, input.owner_id, input.buyer_id, input.lender_id].filter(
    (v): v is number => typeof v === "number",
  );
  const names = await ownerNames(ids);
  if (names.size === 0) return describeAction(name, input);
  const n = (id: unknown) => (typeof id === "number" ? (names.get(id) ?? `#${bn(id)}`) : "");
  const from = n(input.seller_id ?? input.owner_id);
  const to = n(input.buyer_id ?? input.lender_id);
  const label =
    name === "register_baina"
      ? "বায়না নিবন্ধন"
      : name === "register_sale"
        ? "বিক্রয় দলিল নিবন্ধন"
        : "বন্ধক নিবন্ধন";
  const extra = input.days != null ? `, ${bn(String(input.days))} দিন` : "";
  return `${label}: ${input.mouza} দাগ ${bn(String(input.dag_no))}, ${from} → ${to}, ${bn(String(input.area_dec))} শতক${extra}। ঠিক আছে?`;
}
