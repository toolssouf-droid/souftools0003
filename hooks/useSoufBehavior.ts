"use client";

import { useState, useEffect, useCallback } from "react";
import { SoufBehaviorEngine } from "@/lib/behavior/behaviorEngine";
import {
  UserBehaviorProfile,
  BehaviorPrivacyMode,
  BehaviorEventType,
  SmartSuggestion,
  BehaviorContextForAI,
} from "@/lib/behavior/types";
import { auth } from "@/lib/firebase";

export function useSoufBehavior() {
  const [profile, setProfile] = useState<UserBehaviorProfile>(() =>
    SoufBehaviorEngine.getProfile()
  );
  const [smartSuggestion, setSmartSuggestion] = useState<SmartSuggestion | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    // Initialize behavior engine on client side
    SoufBehaviorEngine.initialize(auth.currentUser?.uid || undefined).then((prof) => {
      if (isMounted) {
        setProfile(prof);
        setSmartSuggestion(SoufBehaviorEngine.getSmartSuggestion());
      }
    });

    // Subscribe to updates
    const unsubscribe = SoufBehaviorEngine.subscribe((updatedProfile) => {
      if (isMounted) {
        setProfile(updatedProfile);
        setSmartSuggestion(SoufBehaviorEngine.getSmartSuggestion());
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const logEvent = useCallback(
    (
      type: BehaviorEventType,
      metadata?: { toolName?: string; status?: "success" | "failed"; [key: string]: any }
    ) => {
      SoufBehaviorEngine.logEvent(type, metadata);
    },
    []
  );

  const setPrivacyMode = useCallback(async (mode: BehaviorPrivacyMode) => {
    await SoufBehaviorEngine.setPrivacyMode(mode);
  }, []);

  const clearLocalData = useCallback(async () => {
    await SoufBehaviorEngine.clearLocalData();
  }, []);

  const deleteCloudProfile = useCallback(async () => {
    setIsSyncing(true);
    try {
      await SoufBehaviorEngine.deleteCloudProfile();
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const syncNow = useCallback(async () => {
    setIsSyncing(true);
    try {
      await SoufBehaviorEngine.syncToFirestore(auth.currentUser?.uid || undefined);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const getPersonalizationContext = useCallback((): BehaviorContextForAI | null => {
    return SoufBehaviorEngine.getPersonalizationContext();
  }, []);

  return {
    profile,
    privacyMode: profile.privacyMode,
    smartSuggestion,
    isSyncing,
    logEvent,
    setPrivacyMode,
    clearLocalData,
    deleteCloudProfile,
    syncNow,
    getPersonalizationContext,
  };
}
