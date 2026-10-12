import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { createDownloadUrl } from "../../../lib/links";
import { displayName, ownsKey } from "../../../lib/s3";
import { categoryFor } from "../../../lib/types";

const MAX_KEYS = 40;
const THUMB_LINK_SECONDS = 15 * 60;

/**
 * Picture links for the file cards. Takes up to 40 keys and returns a short-lived link for each key that is
 * (a) inside the signed-in user's own folder and (b) an image. Anything else is silently left out.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const body = await req.json().catch(() => null);
    const keys: unknown = body?.fileKeys;
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > MAX_KEYS) {
      return NextResponse.json({ error: `Send between 1 and ${MAX_KEYS} file keys.` }, { status: 400 });
    }

    const urls: Record<string, string> = {};
    await Promise.all(
      keys.map(async (key) => {
        if (!ownsKey(user.id, key) || categoryFor(displayName(key)) !== "Images") return;
        urls[key] = await createDownloadUrl(key, THUMB_LINK_SECONDS);
      }),
    );
    return NextResponse.json({ urls });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the picture links.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
