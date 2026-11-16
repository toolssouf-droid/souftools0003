import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAuthCookie } from "@/lib/authCookies";

interface WhatsAppPairStore {
  isLinked: boolean;
  pairedPhone: string | null;
  pairingCode: string | null;
  botPhoneNumber: string | null;
  deepLink: string | null;
  linkedAt: number | null;
  isGeneratingCode: boolean;
  isChecking: boolean;
  checkInitialStatus: () => Promise<boolean>;
  generatePairingCode: (
    userEmail?: string | null,
    userId?: string | null,
    firstName?: string | null
  ) => Promise<{ code: string; botPhoneNumber: string; deepLink: string } | null>;
  checkPairingStatus: () => Promise<boolean>;
  unlinkWhatsApp: () => Promise<void>;
  setLinkedData: (data: { pairedPhone?: string; botPhoneNumber?: string }) => void;
}

export const useWhatsAppPairStore = create<WhatsAppPairStore>()(
  persist(
    (set, get) => ({
      isLinked: false,
      pairedPhone: null,
      pairingCode: null,
      botPhoneNumber: null,
      deepLink: null,
      linkedAt: null,
      isGeneratingCode: false,
      isChecking: false,

      checkInitialStatus: async () => {
        try {
          const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
          const headers: Record<string, string> = {};
          if (cookieData?.email) headers["x-user-email"] = cookieData.email;
          if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

          const res = await fetch("/api/whatsapp/pair", {
            headers,
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              if (data.isLinked) {
                set({
                  isLinked: true,
                  pairedPhone: data.pairedPhone || null,
                  botPhoneNumber: data.botPhoneNumber || get().botPhoneNumber,
                  linkedAt: Date.now(),
                });
                return true;
              }
              if (data.botPhoneNumber) {
                set({ botPhoneNumber: data.botPhoneNumber });
              }
            }
          }
          return false;
        } catch (err) {
          console.warn("Failed checking initial WhatsApp pairing status:", err);
          return false;
        }
      },

      generatePairingCode: async (userEmail?: string | null, userId?: string | null, firstName?: string | null) => {
        set({ isGeneratingCode: true });
        try {
          const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          const effectiveEmail = userEmail || cookieData?.email || undefined;
          const effectiveUserId = userId || cookieData?.userId || undefined;
          if (effectiveEmail) headers["x-user-email"] = effectiveEmail;
          if (effectiveUserId) headers["x-user-id"] = effectiveUserId;

          const res = await fetch("/api/whatsapp/pair", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              action: "generate_code",
              email: effectiveEmail,
              userId: effectiveUserId,
              firstName: firstName || undefined,
            }),
          });
          const data = await res.json();
          if (res.ok && data.success) {
            set({
              pairingCode: data.code,
              botPhoneNumber: data.botPhoneNumber,
              deepLink: data.deepLink,
              isGeneratingCode: false,
            });
            return {
              code: data.code,
              botPhoneNumber: data.botPhoneNumber,
              deepLink: data.deepLink,
            };
          }
          set({ isGeneratingCode: false });
          return null;
        } catch (err) {
          console.error("Error generating WhatsApp pairing code:", err);
          set({ isGeneratingCode: false });
          return null;
        }
      },

      checkPairingStatus: async () => {
        const { pairingCode } = get();
        if (!pairingCode) return false;
        set({ isChecking: true });
        try {
          const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
          const headers: Record<string, string> = {};
          if (cookieData?.email) headers["x-user-email"] = cookieData.email;
          if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

          const res = await fetch(`/api/whatsapp/pair?code=${encodeURIComponent(pairingCode)}`, {
            headers,
            credentials: "include",
          });
          const data = await res.json();
          if (res.ok && data.success && data.isLinked) {
            set({
              isLinked: true,
              pairedPhone: data.phone || null,
              botPhoneNumber: data.botPhoneNumber || get().botPhoneNumber,
              linkedAt: Date.now(),
              isChecking: false,
            });
            return true;
          }
          set({ isChecking: false });
          return false;
        } catch (err) {
          console.error("Error checking WhatsApp pairing status:", err);
          set({ isChecking: false });
          return false;
        }
      },

      unlinkWhatsApp: async () => {
        const { pairedPhone, pairingCode } = get();
        try {
          const cookieData = typeof window !== "undefined" ? getAuthCookie() : null;
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (cookieData?.email) headers["x-user-email"] = cookieData.email;
          if (cookieData?.userId) headers["x-user-id"] = cookieData.userId;

          await fetch("/api/whatsapp/pair", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              action: "unlink",
              phone: pairedPhone,
              code: pairingCode,
            }),
          });
        } catch (err) {
          console.error("Error unlinking WhatsApp:", err);
        } finally {
          set({
            isLinked: false,
            pairedPhone: null,
            pairingCode: null,
            deepLink: null,
            linkedAt: null,
          });
        }
      },

      setLinkedData: (data) =>
        set((state) => ({
          isLinked: true,
          pairedPhone: data.pairedPhone || state.pairedPhone,
          botPhoneNumber: data.botPhoneNumber || state.botPhoneNumber,
          linkedAt: Date.now(),
        })),
    }),
    {
      name: "souftools-whatsapp-user-storage",
    }
  )
);
