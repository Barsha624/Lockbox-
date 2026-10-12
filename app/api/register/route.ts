import { NextResponse } from "next/server";
import { AccountExistsError, createAccount, validateRegistration } from "../../../lib/accounts";
import { addHit, tooMany } from "../../../lib/rateLimit";

const HOUR = 60 * 60 * 1000;

/** Creates an email-and-password account. The browser then signs in through NextAuth like normal. */
export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const limitKey = `register:${ip}`;
  if (tooMany(limitKey, 10)) {
    return NextResponse.json({ error: "Too many sign-ups from this connection. Try again in an hour." }, { status: 429 });
  }
  addHit(limitKey, HOUR);

  const body = (await req.json().catch(() => null)) as { name?: unknown; email?: unknown; password?: unknown } | null;
  const problem = validateRegistration(body?.name, body?.email, body?.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  try {
    await createAccount({ name: body!.name as string, email: body!.email as string, password: body!.password as string });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (err instanceof AccountExistsError) {
      return NextResponse.json({ error: "An account with this email already exists. Sign in instead." }, { status: 409 });
    }
    console.error("register failed:", err);
    return NextResponse.json({ error: "Could not create the account. Check the server logs." }, { status: 500 });
  }
}
