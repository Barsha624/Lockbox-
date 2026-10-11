import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { listUserFiles } from "../../../lib/files";
import { region } from "../../../lib/s3";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const files = await listUserFiles(user.id);
    return NextResponse.json({ files, region: region() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load your files.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
