import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createDownloadUrl } from "../../../lib/links";
import { ownsKey } from "../../../lib/s3";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const fileKey: unknown = body?.fileKey;

    // Reject any key that isn't inside the signed-in user's own folder.
    if (!ownsKey(user.id, fileKey)) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    // Short-lived: this link is for opening the file right now.
    const downloadUrl = await createDownloadUrl(fileKey, 300);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the download link.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
