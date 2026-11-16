import { create } from "zustand";
import { persist } from "zustand/middleware";
import { auth } from "@/lib/firebase";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

interface GoogleDriveStore {
  isConnected: boolean;
  accessToken: string | null;
  email: string | null;
  lastConnectedAt: number | null;
  connectDrive: () => Promise<string | null>;
  disconnectDrive: () => void;
  setAccessToken: (token: string | null, email?: string | null) => void;
}

export const useGoogleDriveStore = create<GoogleDriveStore>()(
  persist(
    (set) => ({
      isConnected: false,
      accessToken: null,
      email: null,
      lastConnectedAt: null,
      connectDrive: async () => {
        try {
          const provider = new GoogleAuthProvider();
          provider.addScope("https://www.googleapis.com/auth/drive.readonly");
          provider.addScope("https://www.googleapis.com/auth/drive.file");
          provider.setCustomParameters({
            prompt: "select_account consent",
            access_type: "offline",
          });

          const result = await signInWithPopup(auth, provider);
          const credential = GoogleAuthProvider.credentialFromResult(result);
          const token = credential?.accessToken || null;
          const userEmail = result.user?.email || null;

          if (token) {
            set({
              isConnected: true,
              accessToken: token,
              email: userEmail,
              lastConnectedAt: Date.now(),
            });
            return token;
          }
          return null;
        } catch (error: any) {
          console.error("Google Drive connection error:", error);
          throw error;
        }
      },
      disconnectDrive: () =>
        set({ isConnected: false, accessToken: null, email: null, lastConnectedAt: null }),
      setAccessToken: (token: string | null, email?: string | null) =>
        set({
          isConnected: !!token,
          accessToken: token,
          email: email || null,
          lastConnectedAt: token ? Date.now() : null,
        }),
    }),
    {
      name: "souftools-google-drive-storage",
    }
  )
);
