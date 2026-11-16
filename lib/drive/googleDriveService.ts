/**
 * Google Drive Analysis & Memory Sync Service
 * Reads Google Docs, Text files, PDFs from Drive and integrates insights directly into MemoryEngine.
 */

import { MemoryEngine } from "@/lib/memory/memoryEngine";

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export class GoogleDriveService {
  /**
   * Search files in Google Drive matching a query or get recent files
   */
  static async searchFiles(accessToken: string, query?: string, maxResults = 10): Promise<DriveFileItem[]> {
    try {
      let q = "trashed = false";
      if (query && query.trim()) {
        const cleanQ = query.replace(/'/g, "\\'");
        q += ` and (name contains '${cleanQ}' or fullText contains '${cleanQ}')`;
      }

      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        q
      )}&pageSize=${maxResults}&fields=files(id,name,mimeType,webViewLink,modifiedTime,size)&orderBy=modifiedTime desc`;

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Google Drive API Search error:", errText);
        throw new Error(`Google Drive API error: ${res.statusText}`);
      }

      const data = await res.json();
      return (data.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        webViewLink: f.webViewLink,
        modifiedTime: f.modifiedTime,
        size: f.size,
      }));
    } catch (error: any) {
      console.error("GoogleDriveService.searchFiles error:", error);
      throw error;
    }
  }

  /**
   * Reads raw text content of a Google Drive File (Google Doc, TXT, CSV, JSON, Markdown)
   */
  static async getFileContent(accessToken: string, fileId: string, mimeType: string): Promise<string> {
    try {
      let downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

      // Handle Google Workspace native documents (Docs, Sheets, Slides)
      if (mimeType.includes("vnd.google-apps.document")) {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      } else if (mimeType.includes("vnd.google-apps.spreadsheet")) {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`;
      } else if (mimeType.includes("vnd.google-apps.presentation")) {
        downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
      }

      const res = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Google Drive getFileContent error:", errText);
        return `[تعذر جلب نص الملف: ${res.statusText}]`;
      }

      const text = await res.text();
      // Cap max text length to preserve context window safety (e.g., 20,000 chars)
      return text.slice(0, 20000);
    } catch (error: any) {
      console.error("GoogleDriveService.getFileContent error:", error);
      return `[خطأ أثناء قراءة الملف: ${error.message}]`;
    }
  }

  /**
   * Syncs a document's key content directly into SoufAI Memory Engine
   */
  static async syncDocumentToMemory(
    userId: string,
    fileName: string,
    fileContent: string,
    fileUrl?: string
  ): Promise<{ syncedCount: number; memoryIds: string[] }> {
    if (!userId || !fileContent || fileContent.trim().length < 10) {
      return { syncedCount: 0, memoryIds: [] };
    }

    // Split content into logical knowledge chunks (e.g. paragraphs or sections)
    const paragraphs = fileContent
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 20);

    const memoryIds: string[] = [];

    // Store the document summary/header memory
    const docSummaryCandidate = {
      content: `مستند من Google Drive: [${fileName}] ${fileUrl ? `(${fileUrl})` : ""}\nمحتوى وتفاصيل: ${fileContent.slice(0, 800)}...`,
      type: "project" as const,
      confidence: 0.95,
      importance: 5,
      category: "google_drive",
      tags: ["google_drive", "document", fileName],
    };

    try {
      const stored = await MemoryEngine.storeOrDeduplicateMemory(userId, docSummaryCandidate);
      if (stored?.memory?.id) {
        memoryIds.push(stored.memory.id);
      }
    } catch (err) {
      console.warn("Failed storing document summary memory:", err);
    }

    // Store key individual sections (up to top 5 main paragraphs)
    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      const sectionText = paragraphs[i];
      if (sectionText.length < 30) continue;

      const candidate = {
        content: `معلومة من مستند Google Drive (${fileName}): ${sectionText.slice(0, 500)}`,
        type: "project" as const,
        confidence: 0.88,
        importance: 4,
        category: "google_drive_section",
        tags: ["google_drive", "knowledge", fileName],
      };

      try {
        const result = await MemoryEngine.storeOrDeduplicateMemory(userId, candidate);
        if (result?.memory?.id) {
          memoryIds.push(result.memory.id);
        }
      } catch (err) {
        console.warn("Failed storing section memory candidate:", err);
      }
    }

    return {
      syncedCount: memoryIds.length,
      memoryIds,
    };
  }
}
