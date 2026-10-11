import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "../../../lib/auth";
import { updateIndex } from "../../../lib/meta";
import { bucket, ownsKey, s3 } from "../../../lib/s3";

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const fileKey: unknown = body?.fileKey;

    if (!ownsKey(user.id, fileKey)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: fileKey }));

    // Forget this file's tags too. If this step fails, the file is still gone, so don't fail the request.
    await updateIndex(user.id, (index) => {
      delete index[fileKey];
    }).catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
