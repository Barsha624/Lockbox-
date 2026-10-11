// Shared between the browser and the server. Keep this file free of server-only imports.

export const CATEGORIES = ["Images", "PDFs", "Documents", "Other"] as const;
export type Category = (typeof CATEGORIES)[number];

export type AnalysisSource = "ai" | "rules";

export interface AnalysisResult {
  category: Category;
  summary: string;
  tags: string[];
  source: AnalysisSource;
}

export interface FileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string; // ISO date
  category: Category;
  summary: string | null;
  tags: string[];
  analyzedBy: AnalysisSource | null; // null = not analyzed yet
  starred: boolean;
}

/** How long a share link works. Seven days is the most S3 allows for a signed link. */
export const SHARE_OPTIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 24 * 60, label: "1 day" },
  { minutes: 7 * 24 * 60, label: "7 days" },
] as const;

/** Answer to a question about the user's files. fileKeys point at files the answer refers to. */
export interface AskResult {
  answer: string;
  fileKeys: string[];
  source: AnalysisSource; // "ai" = written by the model, "rules" = plain keyword search
}

export const MAX_UPLOAD_MB = 25;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Only these extensions can be uploaded. Anything executable or scriptable
// (.exe, .sh, .html, .svg, .js ...) is deliberately left out.
export const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "gif", "webp",
  "pdf",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "md", "csv", "json",
  "zip",
] as const;

export const ACCEPT_ATTRIBUTE = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Returns a human-readable problem, or null if the file is fine. Used by both client and server. */
export function checkUpload(name: string, size: number): string | null {
  const ext = extensionOf(name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return ext
      ? `".${ext}" files can't be uploaded. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`
      : "This file has no extension, so its type can't be checked.";
  }
  if (size <= 0) return "This file is empty.";
  if (size > MAX_UPLOAD_BYTES) return `This file is larger than ${MAX_UPLOAD_MB} MB.`;
  return null;
}

export function categoryFor(name: string): Category {
  const ext = extensionOf(name);
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "Images";
  if (ext === "pdf") return "PDFs";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv", "json"].includes(ext)) {
    return "Documents";
  }
  return "Other";
}
