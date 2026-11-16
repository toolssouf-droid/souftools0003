import React from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <ChatLayout locale={locale} />;
}
