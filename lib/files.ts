import { ListObjectsV2Command, type _Object } from "@aws-sdk/client-s3";
import { readIndex } from "./meta";
import { bucket, displayName, INDEX_FILE, s3, userPrefix } from "./s3";
import { categoryFor, type FileItem } from "./types";

/** Every file in one user's folder, newest first, with its saved tags and summary. */
export async function listUserFiles(userId: string): Promise<FileItem[]> {
  const prefix = userPrefix(userId);

  // S3 returns at most 1000 objects per call, so keep asking until there are no more pages.
  const objects: _Object[] = [];
  let token: string | undefined;
  for (let page = 0; page < 20; page++) {
    const res = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token }),
    );
    objects.push(...(res.Contents ?? []));
    token = res.NextContinuationToken;
    if (!token) break;
  }

  const index = await readIndex(userId);

  return objects
    .filter((o): o is _Object & { Key: string } => !!o.Key && o.Key !== prefix + INDEX_FILE)
    .map((o) => {
      const name = displayName(o.Key);
      const meta = index[o.Key];
      return {
        key: o.Key,
        name,
        size: o.Size ?? 0,
        lastModified: (o.LastModified ?? new Date()).toISOString(),
        category: categoryFor(name),
        summary: meta?.summary ?? null,
        tags: meta?.tags ?? [],
        analyzedBy: meta?.source ?? null,
        starred: meta?.starred === true,
      };
    })
    .sort((a, b) => b.lastModified.localeCompare(a.lastModified));
}
