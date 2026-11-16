/**
 * File Generators and Format Handlers for SoufTools
 * Produces real downloadable files (PDF, CSV, XLSX, DOCX, Code, Markdown, JSON, SVG, HTML)
 */

import { SoufFileCategory, SoufFileItem, SoufFileVersion } from "./soufFileType";

export function detectFileCategory(extension: string): SoufFileCategory {
  const ext = extension.toLowerCase().replace(/^\./, "");
  switch (ext) {
    case "pdf":
    case "docx":
    case "doc":
    case "txt":
    case "md":
    case "rtf":
    case "odt":
      return "document";
    case "csv":
    case "xlsx":
    case "xls":
    case "json":
    case "xml":
    case "yaml":
    case "yml":
      return "data";
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "html":
    case "css":
    case "scss":
    case "py":
    case "python":
    case "java":
    case "kt":
    case "c":
    case "cpp":
    case "cs":
    case "go":
    case "rs":
    case "php":
    case "sql":
    case "sh":
    case "bash":
    case "json5":
      return "code";
    case "png":
    case "jpg":
    case "jpeg":
    case "webp":
    case "gif":
    case "svg":
      return "image";
    case "pptx":
    case "ppt":
    case "odp":
      return "presentation";
    case "zip":
    case "tar":
    case "gz":
      return "archive";
    default:
      return "document";
  }
}

export function detectMimeType(extension: string): string {
  const ext = extension.toLowerCase().replace(/^\./, "");
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    txt: "text/plain",
    md: "text/markdown",
    csv: "text/csv",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    json: "application/json",
    xml: "application/xml",
    yaml: "text/yaml",
    yml: "text/yaml",
    html: "text/html",
    css: "text/css",
    js: "application/javascript",
    ts: "application/typescript",
    tsx: "text/tsx",
    jsx: "text/jsx",
    py: "text/x-python",
    java: "text/x-java-source",
    sql: "application/sql",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ppt: "application/vnd.ms-powerpoint",
    zip: "application/zip",
  };
  return mimeMap[ext] || "text/plain";
}

/**
 * Creates a lightweight, valid standard PDF 1.4 binary file in pure TypeScript
 * Compatible with all desktop and mobile PDF readers.
 */
export function generateStandardPdf(title: string, content: string): string {
  // Strip control chars or markdown symbols for simple PDF text lines
  const cleanTitle = (title || "SoufTools Document").replace(/[\r\n]/g, " ");
  
  // Format content lines
  const rawLines = content.split("\n");
  const pdfLines: string[] = [];

  rawLines.forEach((l) => {
    let clean = l.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").trim();
    if (!clean) {
      pdfLines.push("");
      return;
    }
    // wrap long lines
    while (clean.length > 75) {
      pdfLines.push(clean.slice(0, 75));
      clean = clean.slice(75);
    }
    pdfLines.push(clean);
  });

  const maxLinesPerPage = 42;
  const pages: string[][] = [];
  for (let i = 0; i < pdfLines.length; i += maxLinesPerPage) {
    pages.push(pdfLines.slice(i, i + maxLinesPerPage));
  }
  if (pages.length === 0) pages.push(["SoufTools Generated Document"]);

  // Build standard-compliant PDF 1.4 structure
  const objects: string[] = [];

  // Obj 1: Catalog
  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;

  // Obj 3: Font
  const fontObjNum = 3;
  objects[fontObjNum] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`;

  const pageObjNums: number[] = [];
  let currentObj = 4;
  const pageDefs: { contentObjNum: number; pageObjNum: number; streamText: string }[] = [];

  pages.forEach((pageLines, pageIdx) => {
    let streamText = "BT\n/F1 16 Tf\n50 780 Td\n";
    streamText += `(${escapePdfString(pageIdx === 0 ? cleanTitle : `${cleanTitle} (Page ${pageIdx + 1})`)}) Tj\n`;
    streamText += "/F1 10 Tf\n0 -25 Td\n";

    pageLines.forEach((line) => {
      streamText += `(${escapePdfString(line)}) Tj\nT*\n`;
    });
    streamText += "ET\n";

    const contentObjNum = currentObj++;
    const pageObjNum = currentObj++;
    pageObjNums.push(pageObjNum);
    pageDefs.push({ contentObjNum, pageObjNum, streamText });
  });

  // Obj 2: Pages root catalog container
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`;

  pageDefs.forEach(({ contentObjNum, pageObjNum, streamText }) => {
    objects[contentObjNum] = `<< /Length ${Buffer.byteLength(streamText, "utf-8")} >>\nstream\n${streamText}endstream`;
    objects[pageObjNum] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObjNum} 0 R >> >> >>`;
  });

  // Construct binary-accurate PDF with precise cross-reference offsets
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let i = 1; i < objects.length; i++) {
    offsets[i] = Buffer.byteLength(pdf, "utf-8");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf-8");
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${offsets[i].toString().padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return pdf;
}

function escapePdfString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Generates an Excel-compatible workbook (.xlsx / XML spreadsheet) with styling and multiple sheets
 */
export function generateExcelXml(
  sheets: Array<{ name: string; headers: string[]; rows: (string | number)[][] }>
): string {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#00d4aa"/>
   </Borders>
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#ffffff"/>
   <Interior ss:Color="#0a2e28" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="RowEven">
   <Interior ss:Color="#f4fbf9" ss:Pattern="Solid"/>
  </Style>
 </Styles>`;

  sheets.forEach((sheet) => {
    const safeSheetName = (sheet.name || "Sheet1").replace(/[\\/?*[\]]/g, "_").slice(0, 31);
    xml += `\n <Worksheet ss:Name="${safeSheetName}">\n  <Table>`;

    // Headers
    if (sheet.headers && sheet.headers.length > 0) {
      xml += `\n   <Row ss:Height="26">`;
      sheet.headers.forEach((h) => {
        xml += `\n    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(String(h))}</Data></Cell>`;
      });
      xml += `\n   </Row>`;
    }

    // Rows
    sheet.rows.forEach((row, rIdx) => {
      const styleId = rIdx % 2 === 1 ? ' ss:StyleID="RowEven"' : "";
      xml += `\n   <Row ss:Height="20"${styleId}>`;
      row.forEach((val) => {
        const isNum = typeof val === "number" || (!isNaN(Number(val)) && val !== "");
        const dataType = isNum ? "Number" : "String";
        xml += `\n    <Cell><Data ss:Type="${dataType}">${escapeXml(String(val))}</Data></Cell>`;
      });
      xml += `\n   </Row>`;
    });

    xml += `\n  </Table>\n </Worksheet>`;
  });

  xml += `\n</Workbook>`;
  return xml;
}

/**
 * Generates an HTML-based Microsoft Word Document (.doc / .docx compatible)
 */
export function generateWordHtml(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>${escapeXml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #1a1a1a;
      direction: rtl;
      text-align: right;
      padding: 40px;
    }
    h1 { color: #00876c; font-size: 20pt; border-bottom: 2px solid #00d4aa; padding-bottom: 8px; }
    h2 { color: #1e3a38; font-size: 15pt; margin-top: 20px; }
    h3 { color: #334155; font-size: 12pt; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background-color: #00d4aa; color: white; border: 1px solid #00876c; padding: 8px; }
    td { border: 1px solid #cbd5e1; padding: 8px; }
    tr:nth-child(even) { background-color: #f8fafc; }
    blockquote { border-right: 4px solid #00d4aa; margin: 10px 0; padding: 10px 15px; background: #f0fdf9; }
    code { font-family: Consolas, monospace; background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
  <div>${contentHtml}</div>
</body>
</html>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
