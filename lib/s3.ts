import { S3Client } from "@aws-sdk/client-s3";
import { extensionOf } from "./types";

// Credentials come from the standard AWS chain: env vars locally, an IAM role when deployed.
export const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-southeast-2" });

export const region = () => process.env.AWS_REGION || "ap-southeast-2";

export function bucket(): string {
  const name = process.env.AWS_S3_BUCKET_NAME;
  if (!name) throw new Error("AWS_S3_BUCKET_NAME is not set. Add it to .env.local.");
  return name;
}

/** Every user's files live under their own folder, named after their Google account id. */
export function userPrefix(userId: string): string {
  return `users/${userId.replace(/[^a-zA-Z0-9_-]/g, "_")}/`;
}

export const INDEX_FILE = ".index.json";

/**
 * True when a read failed because the object isn't there. S3 answers 403 instead of 404 when the caller
 * has no list permission on the bucket, so a missing file can look like "access denied". Real permission
 * problems still show up: listing and writing (which always follow) fail loudly.
 */
export function isMissingObject(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return err.name === "NoSuchKey" || err.name === "NotFound" || err.name === "AccessDenied" || status === 404 || status === 403;
}

/** Ownership check used by download, delete and analyze. A key outside your folder is rejected. */
export function ownsKey(userId: string, key: unknown): key is string {
  if (typeof key !== "string") return false;
  const prefix = userPrefix(userId);
  return (
    key.startsWith(prefix) &&
    key.length > prefix.length &&
    key !== prefix + INDEX_FILE &&
    !key.includes("..")
  );
}

/** Strips folders and odd characters so a file name can never change the key's path. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const ext = extensionOf(base);
  const stem = ext ? base.slice(0, base.length - ext.length - 1) : base;
  const cleanStem = stem.replace(/[^\w.\- ()]/g, "_").replace(/\s+/g, " ").trim().slice(0, 100) || "file";
  return ext ? `${cleanStem}.${ext}` : cleanStem;
}

const NAME_SEPARATOR = "__";

/** New keys look like users/<id>/<unique>__<name>. The unique part stops same-name uploads overwriting each other. */
export function newFileKey(userId: string, fileName: string): string {
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${userPrefix(userId)}${unique}${NAME_SEPARATOR}${safeFileName(fileName)}`;
}

export function displayName(key: string): string {
  const last = key.split("/").pop() ?? key;
  const i = last.indexOf(NAME_SEPARATOR);
  return i === -1 ? last : last.slice(i + NAME_SEPARATOR.length);
}
