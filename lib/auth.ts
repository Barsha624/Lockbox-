import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { findAccount, MAX_PASSWORD, normalizeEmail, verifyAgainstDummy, verifyPassword } from "./accounts";
import { addHit, clearHits, tooMany } from "./rateLimit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    CredentialsProvider({
      name: "Email and password",
      credentials: { email: { label: "Email", type: "email" }, password: { label: "Password", type: "password" } },
      async authorize(credentials) {
        const email = normalizeEmail(String(credentials?.email ?? ""));
        const password = String(credentials?.password ?? "");
        if (!email || !password || password.length > MAX_PASSWORD) return null;

        // After 5 wrong tries for one email, stop checking for 15 minutes.
        const limitKey = `login:${email}`;
        if (tooMany(limitKey, LOGIN_MAX_FAILURES)) throw new Error("TooManyAttempts");

        try {
          const account = await findAccount(email);
          const ok = account ? await verifyPassword(password, account.passwordHash) : await verifyAgainstDummy(password);
          if (!account || !ok) {
            addHit(limitKey, LOGIN_WINDOW_MS);
            return null;
          }
          clearHits(limitKey);
          return { id: account.id, name: account.name, email: account.email };
        } catch (err) {
          console.error("password sign-in failed:", err);
          throw new Error("ServerError");
        }
      },
    }),
  ],
  session: { strategy: "jwt" },
  // No fallback value on purpose: NextAuth refuses to run in production without a real secret.
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // token.sub is the account's unique id (Google's id, or our own UUID for password accounts). We expose it so the API can build per-user S3 paths.
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
}

/**
 * The ONLY place the API learns who is calling. It reads the signed session cookie on the
 * server, so the browser can't claim to be someone else by sending a different email.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!session || !id) return null;
  return { id, email: session.user.email ?? "", name: session.user.name ?? "" };
}
