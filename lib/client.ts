// Browser-side helpers that talk to our own /api routes.
import type { AnalysisResult, AskResult, FileItem } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (${res.status}).`, res.status);
  return data as T;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function fetchFiles(): Promise<{ files: FileItem[]; region: string }> {
  return request("/api/files");
}

export async function analyzeFile(fileKey: string): Promise<AnalysisResult> {
  return request("/api/analyze", jsonInit("POST", { fileKey }));
}

export async function askVault(question: string): Promise<AskResult> {
  return request("/api/ask", jsonInit("POST", { question }));
}

export async function getDownloadUrl(fileKey: string): Promise<string> {
  const data = await request<{ downloadUrl: string }>("/api/download", jsonInit("POST", { fileKey }));
  return data.downloadUrl;
}

export async function starFile(fileKey: string, starred: boolean): Promise<void> {
  await request("/api/star", jsonInit("POST", { fileKey, starred }));
}

export async function shareFile(
  fileKey: string,
  minutes: number,
): Promise<{ url: string; expiresAt: string; label: string }> {
  return request("/api/share", jsonInit("POST", { fileKey, minutes }));
}

export async function deleteFile(fileKey: string): Promise<void> {
  await request("/api/delete", jsonInit("DELETE", { fileKey }));
}

/**
 * Two steps: ask our server for a short-lived upload URL, then send the file straight to S3.
 * XMLHttpRequest is used instead of fetch because it reports upload progress.
 */
export async function uploadFile(file: File, onProgress: (percent: number) => void): Promise<string> {
  const { uploadUrl, fileKey, contentType } = await request<{
    uploadUrl: string;
    fileKey: string;
    contentType: string;
  }>("/api/upload", jsonInit("POST", { fileName: file.name, fileType: file.type, fileSize: file.size }));

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (error ${xhr.status}). Check the bucket's CORS settings.`));
    xhr.onerror = () =>
      reject(new Error("The upload was blocked. Check the bucket's CORS settings and your connection."));
    xhr.send(file);
  });

  return fileKey;
}
