import { NextRequest, NextResponse } from "next/server";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "../../../lib/auth";
import { updateIndex } from "../../../lib/meta";
import { bucket, ownsKey, s3 } from "../../../lib/s3";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const fileKey: unknown = body?.fileKey;
    const starred: unknown = body?.starred;

    if (!ownsKey(user.id, fileKey)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    if (typeof starred !== "boolean") {
      return NextResponse.json({ error: "starred must be true or false." }, { status: 400 });
    }

    // Don't create index entries for files that don't exist.
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket(), Key: fileKey }));
    } catch {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    await updateIndex(user.id, (index) => {
      if (starred) {
        index[fileKey] = { ...index[fileKey], starred: true };
      } else if (index[fileKey]) {
        delete index[fileKey].starred;
        if (Object.keys(index[fileKey]).length === 0) delete index[fileKey]; // keep the index tidy
      }
    });

    return NextResponse.json({ ok: true, starred });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the star.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
