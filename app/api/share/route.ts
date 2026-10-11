import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "../../../lib/auth";
import { createDownloadUrl } from "../../../lib/links";
import { bucket, ownsKey, s3 } from "../../../lib/s3";
import { SHARE_OPTIONS } from "../../../lib/types";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const fileKey: unknown = body?.fileKey;
    const minutes: unknown = body?.minutes;

    if (!ownsKey(user.id, fileKey)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    // Only the lengths offered in the UI are accepted, so nobody can ask for a link that never expires.
    const option = SHARE_OPTIONS.find((o) => o.minutes === minutes);
    if (!option) {
      return NextResponse.json({ error: "Choose 1 hour, 1 day or 7 days." }, { status: 400 });
    }

    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: fileKey }));
    } catch {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const url = await createDownloadUrl(fileKey, option.minutes * 60);
    const expiresAt = new Date(Date.now() + option.minutes * 60_000).toISOString();
    return NextResponse.json({ url, expiresAt, label: option.label });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the share link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
