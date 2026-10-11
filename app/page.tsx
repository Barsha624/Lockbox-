"use client";

import { useSession } from "next-auth/react";
import Dashboard from "../components/Dashboard";
import { Icon } from "../components/Icon";
import LoginScreen from "../components/LoginScreen";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper" aria-busy="true">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal text-white motion-safe:animate-pulse">
          <Icon name="cloud" className="h-6 w-6" />
        </span>
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (status === "unauthenticated" || !session) return <LoginScreen />;

  return <Dashboard user={session.user} />;
}
