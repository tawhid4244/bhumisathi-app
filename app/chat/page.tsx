import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "সাথী এআই" };

export default function Page() {
  return <ComingSoon titleBn="সাথী এআই" titleEn="Sathi AI chat" task={8} />;
}
