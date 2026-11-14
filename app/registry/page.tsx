import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "সাব-রেজিস্ট্রি ডেমো" };

export default function Page() {
  return <ComingSoon titleBn="সাব-রেজিস্ট্রি ডেমো" titleEn="Sub-registry demo" task={5} />;
}
