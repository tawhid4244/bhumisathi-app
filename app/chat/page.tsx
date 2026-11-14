import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const metadata: Metadata = { title: "সাথী এআই" };

export default function ChatPage() {
  return (
    <>
      <PageHeader titleBn="সাথী এআই" titleEn="Sathi AI: ask about land in Bangla" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4">
        <ChatPanel />
      </main>
    </>
  );
}
