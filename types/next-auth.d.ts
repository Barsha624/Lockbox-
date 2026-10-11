import type { DefaultSession } from "next-auth";

// Adds `user.id` (Google's stable account id) to the session type.
declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string };
  }
}
