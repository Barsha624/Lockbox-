import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bucket, INDEX_FILE, s3, userPrefix } from "./s3";
import type { AnalysisResult } from "./types";

/**
 * Tags, summaries and stars are saved in one small JSON file per user, inside that user's S3 folder
 * (users/<id>/.index.json). This replaces the old local data-cache.json, which disappears on
 * serverless hosts and container restarts.
 *
 * Every field is optional: a file can be starred before it has been analyzed, or analyzed without a star.
 *
 * Known limit: two writes at the exact same moment could overwrite each other. Fine for a
 * personal vault; DynamoDB is the upgrade path.
 */
export type FileMeta = Partial<AnalysisResult> & { analyzedAt?: string; starred?: boolean };
export type MetaIndex = Record<string, FileMeta>;

export async function readIndex(userId: string): Promise<MetaIndex> {
  try {
    const res = await s3.send(
      new GetObjectCommand({ Bucket: bucket(), Key: userPrefix(userId) + INDEX_FILE }),
    );
    const text = (await res.Body?.transformToString()) ?? "{}";
    return JSON.parse(text) as MetaIndex;
  } catch (err) {
    if (err instanceof Error && err.name === "NoSuchKey") return {};
    if (err instanceof SyntaxError) return {};
    throw err;
  }
}

export async function updateIndex(userId: string, change: (index: MetaIndex) => void): Promise<void> {
  const index = await readIndex(userId);
  change(index);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: userPrefix(userId) + INDEX_FILE,
      Body: JSON.stringify(index),
      ContentType: "application/json",
    }),
  );
}
