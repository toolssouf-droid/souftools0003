import React from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale } = await params;
  return <ChatLayout locale={locale} />;
}
