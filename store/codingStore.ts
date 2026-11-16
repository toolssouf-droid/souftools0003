import { create } from "zustand";

export interface WorkspaceItem {
  id: string;
  title: string;
  framework?: string;
  updatedAt: number;
  files?: Record<string, string>;
  description?: string;
}

interface CodingStoreState {
  workspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  setActiveWorkspace: (id: string | null) => void;
  createWorkspace: (title?: string, framework?: string) => string;
  deleteWorkspace: (id: string) => void;
  updateWorkspace: (id: string, updates: Partial<WorkspaceItem>) => void;
}

export const useCodingStore = create<CodingStoreState>((set, get) => ({
  workspaces: [
    {
      id: "ws-default-1",
      title: "منصة SoufTools الذكية",
      framework: "Next.js",
      updatedAt: Date.now() - 3600000 * 2,
    },
    {
      id: "ws-default-2",
      title: "واجهة معالجة البيانات العصبية",
      framework: "React",
      updatedAt: Date.now() - 3600000 * 24,
    },
  ],
  activeWorkspaceId: "ws-default-1",

  setActiveWorkspace: (id: string | null) => {
    set({ activeWorkspaceId: id });
  },

  createWorkspace: (title?: string, framework?: string) => {
    const newId = `ws-${Date.now()}`;
    const newWorkspace: WorkspaceItem = {
      id: newId,
      title: title || "مشروع جديد",
      framework: framework || "Next.js",
      updatedAt: Date.now(),
    };
    set((state) => ({
      workspaces: [newWorkspace, ...state.workspaces],
      activeWorkspaceId: newId,
    }));
    return newId;
  },

  deleteWorkspace: (id: string) => {
    set((state) => {
      const remaining = state.workspaces.filter((w) => w.id !== id);
      return {
        workspaces: remaining,
        activeWorkspaceId: state.activeWorkspaceId === id ? (remaining[0]?.id ?? null) : state.activeWorkspaceId,
      };
    });
  },

  updateWorkspace: (id: string, updates: Partial<WorkspaceItem>) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === id ? { ...w, ...updates, updatedAt: Date.now() } : w
      ),
    }));
  },
}));
