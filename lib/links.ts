import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucket, displayName, s3 } from "./s3";
import { categoryFor } from "./types";

/**
 * A temporary link to one file. Anyone who holds the link can open the file until it expires,
 * so callers must check that the signed-in user owns the key BEFORE calling this.
 * Images and PDFs open in the browser tab; everything else downloads.
 */
export async function createDownloadUrl(key: string, expiresInSeconds: number): Promise<string> {
  const name = displayName(key);
  const inline = ["Images", "PDFs"].includes(categoryFor(name));

  const command = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(name)}`,
  });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
