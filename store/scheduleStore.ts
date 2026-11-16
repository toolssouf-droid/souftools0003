import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ScheduledItemType = 'task' | 'reminder' | 'email';
export type ScheduledItemPriority = 'high' | 'medium' | 'low';
export type ScheduledItemStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledEmailData {
  to: string;
  subject: string;
  body: string;
}

export interface ScheduledItemExecutionResult {
  success: boolean;
  executedAt: number;
  responseMessage: string;
  details?: any;
}

export interface ScheduledItem {
  id: string;
  title: string;
  type: ScheduledItemType;
  dueDate: string; // ISO string or human-readable
  targetTimestamp: number; // Unix timestamp ms
  priority: ScheduledItemPriority;
  category?: string;
  description?: string;
  status: ScheduledItemStatus;
  autoExecute: boolean; // Agent autonomous execution enabled
  monitoredByAgent: boolean; // Agent woke up and verified situation
  createdAt: number;
  emailData?: ScheduledEmailData;
  cancellationReason?: string;
  executionResult?: ScheduledItemExecutionResult;
}

interface ScheduleState {
  items: ScheduledItem[];
  addItem: (item: Omit<ScheduledItem, 'id' | 'createdAt' | 'status' | 'autoExecute' | 'monitoredByAgent'> & { autoExecute?: boolean }) => ScheduledItem;
  updateItem: (id: string, updates: Partial<ScheduledItem>) => void;
  setAutoExecute: (id: string, autoExecute: boolean) => void;
  setExecuting: (id: string) => void;
  markExecuted: (id: string, success: boolean, message: string, details?: any) => void;
  resetForRetry: (id: string) => void;
  cancelItem: (id: string, reason?: string) => boolean;
  completeItem: (id: string) => boolean;
  deleteItem: (id: string) => void;
  getItem: (id: string) => ScheduledItem | undefined;
  getPendingItems: () => ScheduledItem[];
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (itemData) => {
        const newItem: ScheduledItem = {
          ...itemData,
          id: `sched_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: Date.now(),
          status: 'pending',
          autoExecute: itemData.autoExecute ?? true, // Default: agent executes autonomously
          monitoredByAgent: false,
        };
        set((state) => ({
          items: [newItem, ...state.items],
        }));

        // Async sync to Database
        if (typeof window !== "undefined") {
          fetch("/api/tasks/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: newItem.id,
              title: newItem.title,
              type: newItem.type,
              targetTimestamp: newItem.targetTimestamp,
              targetDateIso: newItem.dueDate,
              autoExecute: newItem.autoExecute,
              payload: { emailData: newItem.emailData, description: newItem.description },
            }),
          }).catch(() => {});
        }

        return newItem;
      },
      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        }));
      },
      setAutoExecute: (id, autoExecute) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, autoExecute } : item
          ),
        }));
      },
      setExecuting: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? { ...item, status: 'executing', monitoredByAgent: true } : item
          ),
        }));
      },
      markExecuted: (id, success, message, details) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: success ? 'completed' : 'failed',
                  monitoredByAgent: true,
                  executionResult: {
                    success,
                    executedAt: Date.now(),
                    responseMessage: message,
                    details,
                  },
                }
              : item
          ),
        }));
      },
      resetForRetry: (id) => {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'pending',
                  targetTimestamp: Date.now() + 5000, // Retry in 5 seconds
                  executionResult: undefined,
                }
              : item
          ),
        }));
      },
      cancelItem: (id, reason) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return false;
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id
              ? { ...i, status: 'cancelled', cancellationReason: reason }
              : i
          ),
        }));
        return true;
      },
      completeItem: (id) => {
        const item = get().items.find((i) => i.id === id);
        if (!item) return false;
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, status: 'completed', monitoredByAgent: true } : i
          ),
        }));
        return true;
      },
      deleteItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },
      getItem: (id) => get().items.find((i) => i.id === id),
      getPendingItems: () =>
        get().items.filter((i) => i.status === 'pending'),
    }),
    {
      name: 'soufai_schedule_store',
    }
  )
);
