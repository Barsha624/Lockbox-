import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  session: { strategy: "jwt" },
  // No fallback value on purpose: NextAuth refuses to run in production without a real secret.
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    // token.sub is Google's unique account id. We expose it so the API can build per-user S3 paths.
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
