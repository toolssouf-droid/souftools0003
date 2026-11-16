import { create } from "zustand";
import { persist } from "zustand/middleware";

interface TelegramStore {
  isLinked: boolean;
  telegramChatId: string | null;
  telegramUsername: string | null;
  pairingCode: string | null;
  botUsername: string | null;
  deepLink: string | null;
  linkedAt: number | null;
  isGeneratingCode: boolean;
  isChecking: boolean;
  generatePairingCode: (userEmail?: string | null, userId?: string | null) => Promise<{ code: string; botUsername: string; deepLink: string } | null>;
  checkPairingStatus: () => Promise<boolean>;
  unlinkTelegram: () => Promise<void>;
  setLinkedData: (data: { telegramChatId?: string; telegramUsername?: string; botUsername?: string }) => void;
}

export const useTelegramStore = create<TelegramStore>()(
  persist(
    (set, get) => ({
      isLinked: false,
      telegramChatId: null,
      telegramUsername: null,
      pairingCode: null,
      botUsername: null,
      deepLink: null,
      linkedAt: null,
      isGeneratingCode: false,
      isChecking: false,

      generatePairingCode: async (userEmail?: string | null, userId?: string | null) => {
        set({ isGeneratingCode: true });
        try {
          const res = await fetch("/api/telegram/pair", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "generate_code", email: userEmail || undefined, userId: userId || undefined }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({
              pairingCode: data.code,
              botUsername: data.botUsername,
              deepLink: data.deepLink,
              isGeneratingCode: false,
            });
            return {
              code: data.code,
              botUsername: data.botUsername,
              deepLink: data.deepLink,
            };
          }
          set({ isGeneratingCode: false });
          return null;
        } catch (err) {
          console.error("Error generating Telegram pairing code:", err);
          set({ isGeneratingCode: false });
          return null;
        }
      },

      checkPairingStatus: async () => {
        const { pairingCode } = get();
        if (!pairingCode) return false;
        set({ isChecking: true });
        try {
          const res = await fetch(`/api/telegram/pair?code=${encodeURIComponent(pairingCode)}`);
          const data = await res.json();
          if (res.ok && data.success && data.isLinked) {
            set({
              isLinked: true,
              telegramChatId: data.chatId || null,
              telegramUsername: data.username || null,
              botUsername: data.botUsername || get().botUsername,
              linkedAt: Date.now(),
              isChecking: false,
            });
            return true;
          }
          set({ isChecking: false });
          return false;
        } catch (err) {
          console.error("Error checking Telegram pairing status:", err);
          set({ isChecking: false });
          return false;
        }
      },

      unlinkTelegram: async () => {
        const { telegramChatId, pairingCode } = get();
        try {
          await fetch("/api/telegram/pair", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "unlink",
              chatId: telegramChatId,
              code: pairingCode,
            }),
          });
        } catch (err) {
          console.error("Error unlinking Telegram:", err);
        } finally {
          set({
            isLinked: false,
            telegramChatId: null,
            telegramUsername: null,
            pairingCode: null,
            deepLink: null,
            linkedAt: null,
          });
        }
      },

      setLinkedData: (data) =>
        set((state) => ({
          isLinked: true,
          telegramChatId: data.telegramChatId || state.telegramChatId,
          telegramUsername: data.telegramUsername || state.telegramUsername,
          botUsername: data.botUsername || state.botUsername,
          linkedAt: Date.now(),
        })),
    }),
    {
      name: "souftools-telegram-user-storage",
    }
  )
);
