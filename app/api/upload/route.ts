import { NextRequest, NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentUser } from "../../../lib/auth";
import { bucket, newFileKey, s3 } from "../../../lib/s3";
import { checkUpload } from "../../../lib/types";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const fileName: unknown = body?.fileName;
    const fileSize: unknown = body?.fileSize;
    const fileType: unknown = body?.fileType;

    if (typeof fileName !== "string" || typeof fileSize !== "number") {
      return NextResponse.json({ error: "fileName and fileSize are required." }, { status: 400 });
    }
    const problem = checkUpload(fileName, fileSize);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const contentType =
      typeof fileType === "string" && fileType.length > 0 && fileType.length < 100
        ? fileType
        : "application/octet-stream";

    // The folder comes from the signed-in session, never from the request body.
    const fileKey = newFileKey(user.id, fileName);

    const command = new PutObjectCommand({
      Bucket: bucket(),
      Key: fileKey,
      ContentType: contentType,
      ContentLength: fileSize, // signed into the URL, so S3 rejects an upload of a different size
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return NextResponse.json({ uploadUrl, fileKey, contentType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
