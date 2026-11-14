import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "মৌজা ম্যাপে মাপ" };

export default function Page() {
  return <ComingSoon titleBn="মৌজা ম্যাপে মাপ" titleEn="Mouza map area" task={13} />;
}
