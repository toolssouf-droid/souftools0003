/**
 * Firebase Authentication Client Configuration
 * Firebase is strictly used for client-side Auth (Google, GitHub, Email/Password).
 * No Firestore, No Firebase Storage, No Cloud SQL.
 */

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
  GithubAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyDMddcHJ6s_bbPg9VDcmNxkqWb_LoZLLnw",
  authDomain: "souftoolsheb-92e1c.firebaseapp.com",
  projectId: "souftoolsheb-92e1c",
  storageBucket: "souftoolsheb-92e1c.firebasestorage.app",
  messagingSenderId: "278175064445",
  appId: "1:278175064445:web:33aa47833ab73cef9aec14",
  measurementId: "G-X79Q2QEJM2",
};

// Initialize Firebase App safely (singleton)
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Analytics safely on client side
export let analytics: Analytics | null = null;

// Configure local persistence explicitly so session persists across reloads and tab closes
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn("Firebase setPersistence error:", err);
  });
  try {
    analytics = getAnalytics(app);
  } catch (err) {
    console.warn("Firebase Analytics initialization failed:", err);
  }
}

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
