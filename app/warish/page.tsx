import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "ওয়ারিশ হিসাব" };

export default function Page() {
  return <ComingSoon titleBn="ওয়ারিশ হিসাব" titleEn="Inheritance (warish) calculator" task={11} />;
}
