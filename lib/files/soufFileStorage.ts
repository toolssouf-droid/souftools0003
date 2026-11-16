/**
 * SoufFile Storage Engine
 * High-performance local IndexedDB storage with fallback to localStorage & in-memory cache.
 * Designed for zero Firestore cost on heavy binary blobs and fast client-side previewing.
 */

import { SoufFileItem, SoufFileVersion } from "./soufFileType";
import { detectFileCategory, detectMimeType } from "./fileGenerators";

class SoufFileStorage {
  private memoryCache: Map<string, SoufFileItem> = new Map();
  private dbPromise: Promise<IDBDatabase | null> | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      // Purge any legacy file storage or index from localStorage
      try {
        localStorage.removeItem("souf_files_index");
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("souf_file_")) {
            localStorage.removeItem(key);
          }
        }
      } catch {}

      if ("indexedDB" in window) {
        this.initIndexedDB();
      }
    }
  }

  private initIndexedDB(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open("SoufToolsFilesDB", 1);
        req.onupgradeneeded = (e: any) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains("files")) {
            const store = db.createObjectStore("files", { keyPath: "id" });
            store.createIndex("name", "name", { unique: false });
            store.createIndex("conversationId", "conversationId", { unique: false });
            store.createIndex("updatedAt", "updatedAt", { unique: false });
          }
        };
        req.onsuccess = (e: any) => resolve(e.target.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  /**
   * Saves or updates a file with version history
   */
  public async saveFile(file: SoufFileItem): Promise<SoufFileItem> {
    this.memoryCache.set(file.id, file);

    if (typeof window !== "undefined") {
      try {
        // Try IndexedDB first
        const db = await this.initIndexedDB();
        if (db) {
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction("files", "readwrite");
            const store = tx.objectStore("files");
            const putReq = store.put(file);
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          });
        } else {
          // No local device fallback - files are managed in memory & synced with server
        }
      } catch (err) {
        console.warn("Could not write file to IndexedDB:", err);
      }
    }

    return file;
  }

  /**
   * Retrieves a file by ID
   */
  public async getFile(fileId: string): Promise<SoufFileItem | null> {
    if (this.memoryCache.has(fileId)) {
      return this.memoryCache.get(fileId)!;
    }

    if (typeof window !== "undefined") {
      try {
        const db = await this.initIndexedDB();
        if (db) {
          const file = await new Promise<SoufFileItem | null>((resolve) => {
            const tx = db.transaction("files", "readonly");
            const store = tx.objectStore("files");
            const getReq = store.get(fileId);
            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => resolve(null);
          });
          if (file) {
            this.memoryCache.set(file.id, file);
            return file;
          }
        }
      } catch {}
    }

    return null;
  }

  /**
   * Finds a file by name (useful for agent edit_file or read_file)
   */
  public async findFileByName(fileName: string, conversationId?: string): Promise<SoufFileItem | null> {
    const cleanSearch = fileName.trim().toLowerCase();

    // Check memory first
    for (const file of this.memoryCache.values()) {
      if (file.name.toLowerCase() === cleanSearch || file.name.toLowerCase().includes(cleanSearch)) {
        if (!conversationId || file.conversationId === conversationId) {
          return file;
        }
      }
    }

    // Check IndexedDB
    if (typeof window !== "undefined") {
      try {
        const db = await this.initIndexedDB();
        if (db) {
          const all = await this.getAllFiles();
          const match = all.find(
            (f) =>
              (f.name.toLowerCase() === cleanSearch || f.name.toLowerCase().includes(cleanSearch)) &&
              (!conversationId || f.conversationId === conversationId)
          );
          if (match) return match;
        }
      } catch {}
    }

    return null;
  }

  /**
   * Retrieves all stored files
   */
  public async getAllFiles(): Promise<SoufFileItem[]> {
    if (typeof window !== "undefined") {
      try {
        const db = await this.initIndexedDB();
        if (db) {
          return await new Promise<SoufFileItem[]>((resolve) => {
            const tx = db.transaction("files", "readonly");
            const store = tx.objectStore("files");
            const req = store.getAll();
            req.onsuccess = () => {
              const res = req.result || [];
              res.forEach((f) => this.memoryCache.set(f.id, f));
              resolve(res);
            };
            req.onerror = () => resolve(Array.from(this.memoryCache.values()));
          });
        }
      } catch {}
    }
    return Array.from(this.memoryCache.values());
  }

  /**
   * Creates a new version for an existing file
   */
  public async addVersion(fileId: string, newContent: string, summary?: string): Promise<SoufFileItem | null> {
    const file = await this.getFile(fileId);
    if (!file) return null;

    const newVerNumber = (file.version || 1) + 1;
    const newVersion: SoufFileVersion = {
      version: newVerNumber,
      content: newContent,
      size: new Blob([newContent]).size,
      summary: summary || `تعديل الإصدار v${newVerNumber}`,
      createdAt: Date.now(),
    };

    file.versions = [...(file.versions || []), newVersion];
    file.version = newVerNumber;
    file.content = newContent;
    file.size = newVersion.size;
    file.updatedAt = Date.now();
    if (summary) file.summary = summary;

    await this.saveFile(file);
    return file;
  }
}

export const globalSoufFileStorage = new SoufFileStorage();

/**
 * Downloads a file directly in the user's browser
 */
export function triggerFileDownload(file: SoufFileItem, targetVersion?: number) {
  if (typeof window === "undefined") return;

  const contentToDownload =
    targetVersion && file.versions?.find((v) => v.version === targetVersion)
      ? file.versions.find((v) => v.version === targetVersion)!.content
      : file.content;

  let blob: Blob;

  if (file.content.startsWith("data:") && file.content.includes(";base64,")) {
    // Binary Base64
    const parts = file.content.split(";base64,");
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    blob = new Blob([byteArray], { type: file.mimeType });
  } else if (file.extension === "csv") {
    // Add UTF-8 BOM so Excel opens Arabic properly
    blob = new Blob(["\uFEFF" + contentToDownload], { type: "text/csv;charset=utf-8;" });
  } else {
    blob = new Blob([contentToDownload], { type: file.mimeType || "text/plain;charset=utf-8;" });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
