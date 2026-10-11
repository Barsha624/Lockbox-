// One place that talks to the Gemini API. Used for file tagging (analyze.ts) and for answering questions (ask.ts).

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * Sends `parts` to Gemini and returns the parsed JSON it replies with.
 * Returns null on ANY problem (no key, network error, bad status, bad JSON), so callers can fall back
 * to something simple and the app never breaks because the AI is down.
 */
export async function generateJson(
  parts: unknown[],
  schema: Record<string, unknown>,
  timeoutMs = 25_000,
): Promise<unknown | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        // The key goes in a header, never in the URL, so it can't leak into logs.
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2, responseSchema: schema },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const text: unknown = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string") return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
