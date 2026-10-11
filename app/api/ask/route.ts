import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { askVault } from "../../../lib/ask";
import { listUserFiles } from "../../../lib/files";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
    if (question.length > 500) {
      return NextResponse.json({ error: "Keep the question under 500 characters." }, { status: 400 });
    }

    // Only the signed-in user's own files are loaded, so no one else's files can reach the AI or the answer.
    const files = await listUserFiles(user.id);
    return NextResponse.json(await askVault(question, files));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not answer that question.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
