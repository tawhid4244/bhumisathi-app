import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "জমি যাচাই" };

export default function Page() {
  return (
    <ComingSoon titleBn="জমি যাচাই" titleEn="Jomi Check: check land before you buy" task={4} />
  );
}
