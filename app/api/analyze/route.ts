import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "../../../lib/auth";
import { AI_MAX_BYTES, analyze, ruleBasedAnalysis } from "../../../lib/analyze";
import { updateIndex } from "../../../lib/meta";
import { bucket, displayName, ownsKey, s3 } from "../../../lib/s3";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const fileKey: unknown = body?.fileKey;

    if (!ownsKey(user.id, fileKey)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const name = displayName(fileKey);

    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: fileKey }));
    } catch {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    let result = ruleBasedAnalysis(name);
    if ((head.ContentLength ?? 0) <= AI_MAX_BYTES) {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: fileKey }));
      const bytes = (await object.Body?.transformToByteArray()) ?? new Uint8Array();
      result = await analyze({ name, contentType: head.ContentType, bytes });
    }

    await updateIndex(user.id, (index) => {
      // Merge, so a star on this file is kept when it gets (re)analyzed.
      index[fileKey] = { ...index[fileKey], ...result, analyzedAt: new Date().toISOString() };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyze the file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
