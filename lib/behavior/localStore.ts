/**
 * SoufBehavior Engine - IndexedDB & Bounded Local Storage
 * Fast, offline-capable, bounded storage with zero dependencies
 */

import { BehaviorEvent, UserBehaviorProfile } from "./types";

const DB_NAME = "SoufBehaviorDB";
const DB_VERSION = 1;
const EVENTS_STORE = "raw_events";
const PROFILE_STORE = "user_profile";
const MAX_RAW_EVENTS = 500;

class LocalBehaviorStorage {
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private memoryEvents: BehaviorEvent[] = [];
  private memoryProfile: UserBehaviorProfile | null = null;

  constructor() {
    if (typeof window !== "undefined" && "indexedDB" in window) {
      this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(EVENTS_STORE)) {
            const store = db.createObjectStore(EVENTS_STORE, { keyPath: "id" });
            store.createIndex("timestamp", "timestamp", { unique: false });
          }
          if (!db.objectStoreNames.contains(PROFILE_STORE)) {
            db.createObjectStore(PROFILE_STORE, { keyPath: "id" });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          console.warn("SoufBehavior: IndexedDB unavailable, falling back to localStorage");
          resolve(null);
        };
      } catch (e) {
        console.warn("SoufBehavior: IndexedDB init error, fallback active");
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Save a raw event locally (bounded by MAX_RAW_EVENTS)
   */
  async saveEvent(event: BehaviorEvent): Promise<void> {
    const db = await this.initDB();

    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([EVENTS_STORE], "readwrite");
          const store = tx.objectStore(EVENTS_STORE);
          store.put(event);
          tx.oncomplete = () => {
            this.enforceEventBounds(db);
            resolve();
          };
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    // Fallback to localStorage / memory
    this.memoryEvents.push(event);
    if (this.memoryEvents.length > MAX_RAW_EVENTS) {
      this.memoryEvents = this.memoryEvents.slice(-MAX_RAW_EVENTS);
    }
    this.saveMemoryEventsToLocalStorage();
  }

  /**
   * Keep raw events bounded
   */
  private async enforceEventBounds(db: IDBDatabase): Promise<void> {
    try {
      const tx = db.transaction([EVENTS_STORE], "readwrite");
      const store = tx.objectStore(EVENTS_STORE);
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result;
        if (count > MAX_RAW_EVENTS) {
          const index = store.index("timestamp");
          const deleteCount = count - MAX_RAW_EVENTS;
          let deleted = 0;

          index.openCursor().onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor && deleted < deleteCount) {
              cursor.delete();
              deleted++;
              cursor.continue();
            }
          };
        }
      };
    } catch {}
  }

  /**
   * Retrieve all local unpruned raw events
   */
  async getEvents(): Promise<BehaviorEvent[]> {
    const db = await this.initDB();

    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([EVENTS_STORE], "readonly");
          const store = tx.objectStore(EVENTS_STORE);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    this.loadMemoryEventsFromLocalStorage();
    return this.memoryEvents;
  }

  /**
   * Prune raw events up to a given timestamp after aggregation
   */
  async pruneEventsUpTo(timestamp: number): Promise<void> {
    const db = await this.initDB();

    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([EVENTS_STORE], "readwrite");
          const store = tx.objectStore(EVENTS_STORE);
          const index = store.index("timestamp");
          const range = IDBKeyRange.upperBound(timestamp);

          index.openCursor(range).onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    this.memoryEvents = this.memoryEvents.filter((ev) => ev.timestamp > timestamp);
    this.saveMemoryEventsToLocalStorage();
  }

  /**
   * Save the local user behavior profile
   */
  async saveProfile(profile: UserBehaviorProfile): Promise<void> {
    this.memoryProfile = profile;
    const db = await this.initDB();

    if (db) {
      return new Promise((resolve) => {
        try {
          const tx = db.transaction([PROFILE_STORE], "readwrite");
          const store = tx.objectStore(PROFILE_STORE);
          store.put({ id: "current_profile", ...profile });
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("souf_behavior_profile");
      } catch {}
    }
  }

  /**
   * Get the local user behavior profile
   */
  async getProfile(): Promise<UserBehaviorProfile | null> {
    if (this.memoryProfile) return this.memoryProfile;

    const db = await this.initDB();

    if (db) {
      const dbProfile = await new Promise<UserBehaviorProfile | null>((resolve) => {
        try {
          const tx = db.transaction([PROFILE_STORE], "readonly");
          const store = tx.objectStore(PROFILE_STORE);
          const req = store.get("current_profile");
          req.onsuccess = () => {
            if (req.result) {
              const { id, ...prof } = req.result;
              resolve(prof as UserBehaviorProfile);
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });

      if (dbProfile) {
        this.memoryProfile = dbProfile;
        return dbProfile;
      }
    }

    return null;
  }

  /**
   * Clear all local events and profile data
   */
  async clearAllData(): Promise<void> {
    this.memoryEvents = [];
    this.memoryProfile = null;

    const db = await this.initDB();
    if (db) {
      try {
        const tx = db.transaction([EVENTS_STORE, PROFILE_STORE], "readwrite");
        tx.objectStore(EVENTS_STORE).clear();
        tx.objectStore(PROFILE_STORE).clear();
      } catch {}
    }

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("souf_behavior_profile");
        localStorage.removeItem("souf_behavior_events");
      } catch {}
    }
  }

  private saveMemoryEventsToLocalStorage() {
    // STRICT: No user events written to localStorage
  }

  private loadMemoryEventsFromLocalStorage() {
    // Purge any legacy behavior events
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem("souf_behavior_events");
      } catch {}
    }
  }
}

export const localBehaviorStore = new LocalBehaviorStorage();
