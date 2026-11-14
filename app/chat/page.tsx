import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ChatPanel } from "@/components/chat/ChatPanel";

export const metadata: Metadata = { title: "সাথী এআই" };

export default function ChatPage(props: PageProps<"/chat">) {
  return (
    <>
      <PageHeader titleBn="সাথী এআই" titleEn="Sathi AI: ask about land in Bangla" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4">
        <Suspense fallback={<ChatPanel />}>
          <PrefilledChat searchParams={props.searchParams} />
        </Suspense>
      </main>
    </>
  );
}

/** Opened from another page with ?q=…: the question is put in the box (not sent). */
async function PrefilledChat({ searchParams }: Pick<PageProps<"/chat">, "searchParams">) {
  const q = (await searchParams).q;
  const text = typeof q === "string" ? q.slice(0, 300) : "";
  return <ChatPanel initialInput={text} />;
}
