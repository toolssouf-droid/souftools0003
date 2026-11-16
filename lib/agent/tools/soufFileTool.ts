/**
 * SoufFile Agent Tool
 * Enables SoufAI to create, edit, read, preview, and export rich files
 * (PDF, XLSX, CSV, DOCX, Code, Markdown, JSON, HTML, SVG, PPTX)
 */

import { AgentTool, AgentToolExecutionContext, StructuredToolResult } from "./toolInterface";
import { SoufFileItem, SoufFileToolArgs, SoufFileVersion } from "@/lib/files/soufFileType";
import {
  detectFileCategory,
  detectMimeType,
  generateStandardPdf,
  generateExcelXml,
  generateWordHtml,
} from "@/lib/files/fileGenerators";
import { globalSoufFileStorage } from "@/lib/files/soufFileStorage";
import { ObjectStorage } from "@/lib/storage/objectStorage";

function buildFileItem(
  name: string,
  content: string,
  title?: string,
  summary?: string,
  userId?: string,
  conversationId?: string,
  customExt?: string
): SoufFileItem {
  const parts = name.split(".");
  const ext = (customExt || (parts.length > 1 ? parts.pop() : "txt") || "txt").toLowerCase();
  const baseName = parts.length > 0 ? parts.join(".") : name;
  const fullName = `${baseName}.${ext}`;

  const category = detectFileCategory(ext);
  let processedContent = content;

  // Format content for binary/structured types if needed
  if (ext === "pdf" && !content.startsWith("%PDF")) {
    processedContent = generateStandardPdf(title || baseName, content);
  } else if (ext === "docx" && !content.startsWith("<!DOCTYPE html")) {
    processedContent = generateWordHtml(title || baseName, content.replace(/\n/g, "<br/>"));
  }

  const mimeType = detectMimeType(ext);
  const size = Buffer.byteLength(processedContent, "utf8");
  const now = Date.now();
  const fileId = `file_${now}_${Math.random().toString(36).slice(2, 7)}`;

  const firstVersion: SoufFileVersion = {
    version: 1,
    content: processedContent,
    size,
    summary: summary || "النسخة الأصلية المبدئية (v1)",
    createdAt: now,
  };

  return {
    id: fileId,
    name: fullName,
    extension: ext,
    category,
    mimeType,
    size,
    version: 1,
    versions: [firstVersion],
    content: processedContent,
    createdAt: now,
    updatedAt: now,
    userId,
    conversationId,
    title: title || baseName,
    summary: summary || `تم إنشاء ملف ${fullName} بنجاح`,
    metadata: {
      lineCount: content.split("\n").length,
      wordCount: content.trim().split(/\s+/).filter(Boolean).length,
    },
  };
}

export const soufFileTool: AgentTool = {
  name: "souf_file",
  description:
    "أداة إدارة وإنشاء ومعاينة وتعديل وتصدير الملفات والمستندات (PDF, XLSX, CSV, DOCX, Code, Markdown, JSON, HTML, PPTX, Images) داخل منصة SoufTools دون الحاجة لساندبوكس خارجي.",
  inputSchema: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        description: "العملية المراد تنفيذها على الملفات",
        enum: ["create_file", "edit_file", "read_file", "preview_file", "create_multiple_files", "export_file"],
      },
      fileName: {
        type: "string",
        description: "اسم الملف كاملاً متضمناً الامتداد (مثال: report_2026.pdf أو sales.xlsx أو main.py)",
      },
      fileId: {
        type: "string",
        description: "معرف الملف في حالة التعديل أو القراءة أو التصدير",
      },
      content: {
        type: "string",
        description: "محتوى الملف بالكامل (نص، كود، بيانات CSV، جدول، كود HTML، إلخ)",
      },
      title: {
        type: "string",
        description: "عنوان توضيحي مقروء للمستند أو الملف",
      },
      summary: {
        type: "string",
        description: "وصف أو ملخص قصير باللغة العربية يوضح ما يحتويه الملف وما تم تنفيذه",
      },
      fileType: {
        type: "string",
        description: "نوع الملف الاختياري (pdf, xlsx, csv, docx, code, json, md, html)",
      },
      files: {
        type: "array",
        description: "قائمة الملفات في حالة إنشاء ملفات متعددة دفعة واحدة",
        items: {
          type: "object",
          properties: {
            fileName: { type: "string" },
            content: { type: "string" },
            title: { type: "string" },
            summary: { type: "string" },
            fileType: { type: "string" },
          },
        },
      },
    },
    required: ["operation"],
  },
  permissions: ["files:write", "files:read"],
  timeout: 15000,
  cost: 1,
  supportsParallel: true,
  execute: async (args: SoufFileToolArgs, context: AgentToolExecutionContext): Promise<StructuredToolResult> => {
    const { operation, fileName, fileId, content, title, summary, files } = args;

    if (context.onProgress) {
      context.onProgress({
        title: `📁 إدارة الملفات: ${operation}`,
        summary: fileName || (files && files.length > 0 ? `${files.length} ملفات` : "معالجة الملف"),
      });
    }

    try {
      // -----------------------------------------------------------------
      // 1. CREATE FILE
      // -----------------------------------------------------------------
      if (operation === "create_file") {
        const targetName = fileName || `file_${Date.now()}.txt`;
        const targetContent = content || "";

        const fileItem = buildFileItem(
          targetName,
          targetContent,
          title,
          summary,
          context.userId,
          context.taskId,
          args.fileType
        );

        await globalSoufFileStorage.saveFile(fileItem);

        // Permanently persist to PostgreSQL and private secure disk storage
        try {
          const putRes = await ObjectStorage.putObject({
            userId: context.userId || "user_active",
            filename: fileItem.name,
            buffer: Buffer.from(fileItem.content, "utf8"),
            mimeType: fileItem.mimeType,
            conversationId: context.taskId,
            metadata: {
              fileId: fileItem.id,
              title: fileItem.title,
              summary: fileItem.summary,
              category: fileItem.category,
              version: fileItem.version,
              source: "souf_file_agent",
            },
          });
          if (putRes.success && putRes.file) {
            fileItem.downloadUrl = putRes.file.signedUrl;
          }
        } catch (storageErr) {
          console.warn("[soufFileTool] PostgreSQL storage persistence notice:", storageErr);
        }

        return {
          success: true,
          tool: "souf_file",
          data: {
            fileId: fileItem.id,
            name: fileItem.name,
            extension: fileItem.extension,
            category: fileItem.category,
            size: fileItem.size,
            version: fileItem.version,
            summary: fileItem.summary,
            downloadUrl: fileItem.downloadUrl,
          },
          widgetData: {
            type: "souf_file",
            data: {
              activeFile: fileItem,
              operation: "create_file",
              summary: fileItem.summary,
            },
          },
          contextNote: `[تم إنشاء وحفظ الملف بنجاح في قاعدة بيانات SoufTools]:\n- اسم الملف: ${fileItem.name}\n- المعرف: ${fileItem.id}\n- النوع: ${fileItem.category} (${fileItem.extension})\n- الحجم: ${(fileItem.size / 1024).toFixed(1)} KB\n- الإصدار: v${fileItem.version}\n- الملخص: ${fileItem.summary}\n${fileItem.downloadUrl ? `- رابط التنزيل المباشر: ${fileItem.downloadUrl}\n` : ""}الملف الآن محفوظ في قاعدة البيانات ومتاح للمعاينة والتنزيل والتعديل مباشرة من واجهة المستخدم.`,
          error: null,
        };
      }

      // -----------------------------------------------------------------
      // 2. EDIT FILE (NEW VERSION v2, v3...)
      // -----------------------------------------------------------------
      if (operation === "edit_file") {
        let existingFile: SoufFileItem | null = null;
        if (fileId) {
          existingFile = await globalSoufFileStorage.getFile(fileId);
        }
        if (!existingFile && fileName) {
          existingFile = await globalSoufFileStorage.findFileByName(fileName, context.taskId);
        }

        if (!existingFile) {
          return {
            success: false,
            tool: "souf_file",
            data: null,
            error: {
              code: "FILE_NOT_FOUND",
              message: `الملف المراد تعديله (${fileId || fileName}) غير موجود`,
              retryable: false,
            },
          };
        }

        const newContent = content || existingFile.content;
        const editSummary = summary || `تعديل المحتوى وإصدار v${existingFile.version + 1}`;
        const updatedFile = await globalSoufFileStorage.addVersion(existingFile.id, newContent, editSummary);

        if (updatedFile) {
          try {
            const putRes = await ObjectStorage.putObject({
              userId: context.userId || "user_active",
              filename: updatedFile.name,
              buffer: Buffer.from(updatedFile.content, "utf8"),
              mimeType: updatedFile.mimeType,
              conversationId: context.taskId,
              metadata: {
                fileId: updatedFile.id,
                title: updatedFile.title,
                summary: editSummary,
                category: updatedFile.category,
                version: updatedFile.version,
                source: "souf_file_agent_edit",
              },
            });
            if (putRes.success && putRes.file) {
              updatedFile.downloadUrl = putRes.file.signedUrl;
            }
          } catch (storageErr) {
            console.warn("[soufFileTool] PostgreSQL storage edit persistence notice:", storageErr);
          }
        }

        return {
          success: true,
          tool: "souf_file",
          data: {
            fileId: updatedFile?.id,
            name: updatedFile?.name,
            version: updatedFile?.version,
            summary: editSummary,
            downloadUrl: updatedFile?.downloadUrl,
          },
          widgetData: {
            type: "souf_file",
            data: {
              activeFile: updatedFile,
              operation: "edit_file",
              summary: editSummary,
            },
          },
          contextNote: `[تم تعديل الملف وحفظه بنجاح في قاعدة البيانات]:\n- اسم الملف: ${updatedFile?.name}\n- الإصدار الجديد: v${updatedFile?.version}\n- ما تم تعديله: ${editSummary}`,
          error: null,
        };
      }

      // -----------------------------------------------------------------
      // 3. READ FILE
      // -----------------------------------------------------------------
      if (operation === "read_file") {
        let file: SoufFileItem | null = null;
        if (fileId) {
          file = await globalSoufFileStorage.getFile(fileId);
        }
        if (!file && fileName) {
          file = await globalSoufFileStorage.findFileByName(fileName, context.taskId);
        }

        // Also check if it exists in context.attachments
        if (!file && fileName && context.attachments && context.attachments.length > 0) {
          const att = context.attachments.find((a) => (a.name || "").toLowerCase().includes(fileName.toLowerCase()));
          if (att) {
            let attContent = att.data || "";
            if (attContent.includes(";base64,")) {
              attContent = Buffer.from(attContent.split(";base64,")[1], "base64").toString("utf-8");
            }
            return {
              success: true,
              tool: "souf_file",
              data: { name: att.name, size: att.size },
              contextNote: `[محتوى الملف المرفق (${att.name})]:\n${attContent.slice(0, 10000)}`,
              error: null,
            };
          }
        }

        if (!file) {
          return {
            success: false,
            tool: "souf_file",
            data: null,
            error: { code: "FILE_NOT_FOUND", message: `الملف ${fileName || fileId} غير موجود للقراءة`, retryable: false },
          };
        }

        return {
          success: true,
          tool: "souf_file",
          data: {
            fileId: file.id,
            name: file.name,
            version: file.version,
            size: file.size,
            length: file.content.length,
          },
          contextNote: `[محتوى الملف (${file.name} - v${file.version})]:\n${file.content.slice(0, 10000)}`,
          error: null,
        };
      }

      // -----------------------------------------------------------------
      // 4. PREVIEW FILE
      // -----------------------------------------------------------------
      if (operation === "preview_file") {
        let file: SoufFileItem | null = null;
        if (fileId) file = await globalSoufFileStorage.getFile(fileId);
        if (!file && fileName) file = await globalSoufFileStorage.findFileByName(fileName, context.taskId);

        if (!file) {
          return {
            success: false,
            tool: "souf_file",
            data: null,
            error: { code: "FILE_NOT_FOUND", message: "الملف غير موجود للمعاينة", retryable: false },
          };
        }

        return {
          success: true,
          tool: "souf_file",
          data: { fileId: file.id, name: file.name },
          widgetData: {
            type: "souf_file",
            data: {
              activeFile: file,
              operation: "preview_file",
              summary: `معاينة ملف ${file.name}`,
            },
          },
          contextNote: `[تم تجهيز شاشة المعاينة لملف ${file.name} (الإصدار v${file.version})]`,
          error: null,
        };
      }

      // -----------------------------------------------------------------
      // 5. CREATE MULTIPLE FILES
      // -----------------------------------------------------------------
      if (operation === "create_multiple_files") {
        const fileList = files || [];
        if (fileList.length === 0) {
          return {
            success: false,
            tool: "souf_file",
            data: null,
            error: { code: "NO_FILES_SPECIFIED", message: "لم يتم تحديد أي ملفات للإنشاء", retryable: false },
          };
        }

        const createdItems: SoufFileItem[] = [];
        for (const f of fileList) {
          const item = buildFileItem(
            f.fileName,
            f.content,
            f.title,
            f.summary,
            context.userId,
            context.taskId,
            f.fileType
          );
          await globalSoufFileStorage.saveFile(item);

          try {
            const putRes = await ObjectStorage.putObject({
              userId: context.userId || "user_active",
              filename: item.name,
              buffer: Buffer.from(item.content, "utf8"),
              mimeType: item.mimeType,
              conversationId: context.taskId,
              metadata: {
                fileId: item.id,
                title: item.title,
                summary: item.summary,
                category: item.category,
                version: item.version,
                source: "souf_file_agent_batch",
              },
            });
            if (putRes.success && putRes.file) {
              item.downloadUrl = putRes.file.signedUrl;
            }
          } catch (storageErr) {
            console.warn("[soufFileTool] Batch PostgreSQL storage notice:", storageErr);
          }

          createdItems.push(item);
        }

        return {
          success: true,
          tool: "souf_file",
          data: {
            count: createdItems.length,
            files: createdItems.map((c) => ({ id: c.id, name: c.name, size: c.size, version: c.version })),
          },
          widgetData: {
            type: "souf_files",
            data: {
              activeFile: createdItems[0],
              files: createdItems,
              operation: "create_multiple_files",
              summary: summary || `تم إنشاء ${createdItems.length} ملفات بنجاح`,
            },
          },
          contextNote: `[تم إنشاء ${createdItems.length} ملفات بنجاح]:\n` +
            createdItems.map((c) => `- ${c.name} (${(c.size / 1024).toFixed(1)} KB) [${c.id}]`).join("\n"),
          error: null,
        };
      }

      // -----------------------------------------------------------------
      // 6. EXPORT FILE
      // -----------------------------------------------------------------
      if (operation === "export_file") {
        let file: SoufFileItem | null = null;
        if (fileId) file = await globalSoufFileStorage.getFile(fileId);
        if (!file && fileName) file = await globalSoufFileStorage.findFileByName(fileName, context.taskId);

        if (!file) {
          return {
            success: false,
            tool: "souf_file",
            data: null,
            error: { code: "FILE_NOT_FOUND", message: "الملف غير موجود للتصدير", retryable: false },
          };
        }

        return {
          success: true,
          tool: "souf_file",
          data: {
            fileId: file.id,
            name: file.name,
            downloadReady: true,
          },
          widgetData: {
            type: "souf_file",
            data: {
              activeFile: file,
              operation: "export_file",
              summary: `الملف ${file.name} جاهز للتنزيل الفوري`,
            },
          },
          contextNote: `[الملف ${file.name} جاهز للتنزيل الفوري للمستخدم]`,
          error: null,
        };
      }

      return {
        success: false,
        tool: "souf_file",
        data: null,
        error: { code: "INVALID_OPERATION", message: `العملية '${operation}' غير صالحة`, retryable: false },
      };
    } catch (err: any) {
      return {
        success: false,
        tool: "souf_file",
        data: null,
        error: { code: "EXEC_ERROR", message: err?.message || "حدث خطأ أثناء معالجة الملف", retryable: true },
      };
    }
  },
};
