/**
 * SoufFile Type Definitions
 * Represents rich files, multi-versions, categories, and preview modes in SoufTools
 */

export type SoufFileCategory =
  | "document"      // PDF, DOCX, DOC, TXT, MD, RTF, ODT
  | "data"          // CSV, XLSX, XLS, JSON, XML, YAML
  | "code"          // JS, TS, JSX, TSX, HTML, CSS, Python, SQL, etc.
  | "image"         // PNG, JPG, JPEG, WEBP, GIF, SVG
  | "presentation"  // PPTX, PPT, ODP
  | "archive";      // ZIP, TAR

export interface SoufFileVersion {
  version: number;
  content: string; // Text content, code, data string, or Base64/DataURL
  size: number;    // Size in bytes
  summary?: string;
  createdAt: number;
  metadata?: Record<string, any>;
}

export interface SoufFileItem {
  id: string;
  name: string;
  extension: string;
  category: SoufFileCategory;
  mimeType: string;
  size: number;
  version: number;
  versions: SoufFileVersion[];
  content: string; // Active version content
  createdAt: number;
  updatedAt: number;
  userId?: string;
  conversationId?: string;
  title?: string;
  summary?: string;
  downloadUrl?: string;
  metadata?: {
    lineCount?: number;
    wordCount?: number;
    sheetNames?: string[];
    rowCount?: number;
    colCount?: number;
    slideCount?: number;
    language?: string;
    width?: number;
    height?: number;
    [key: string]: any;
  };
}

export interface SoufFileToolArgs {
  operation: "create_file" | "edit_file" | "read_file" | "preview_file" | "create_multiple_files" | "export_file";
  fileName?: string;
  fileId?: string;
  content?: string;
  fileType?: string;
  title?: string;
  summary?: string;
  targetFormat?: string;
  // Multiple files batch
  files?: Array<{
    fileName: string;
    content: string;
    title?: string;
    summary?: string;
    fileType?: string;
  }>;
  // Metadata options
  sheets?: Array<{ name: string; headers: string[]; rows: (string | number)[][] }>;
  slides?: Array<{ title: string; bullets: string[]; notes?: string }>;
}

export interface SoufFileWidgetData {
  type: "souf_file" | "souf_files";
  activeFile: SoufFileItem;
  files?: SoufFileItem[];
  operation?: string;
  summary?: string;
}
