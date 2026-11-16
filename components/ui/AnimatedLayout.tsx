"use client";

import React from "react";
import { motion } from "motion/react";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { useBackgroundScheduler } from "@/lib/scheduler/backgroundScheduler";

export const AnimatedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Activate autonomous agent background task and email scheduler
  useBackgroundScheduler();

  return (
    <AuthProvider>
      <motion.div
        initial={{ opacity: 0.96 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.08, ease: "easeOut" }}
        className="w-full min-h-screen"
      >
        {children}
      </motion.div>
    </AuthProvider>
  );
};



