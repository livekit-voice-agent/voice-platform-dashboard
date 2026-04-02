"use client";

import {
  SessionProvider as NextAuthSessionProvider,
  useSession,
} from "next-auth/react";
import { useEffect } from "react";
import { setApiToken } from "@/lib/api";

function TokenSync({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  useEffect(() => {
    setApiToken(session?.apiToken ?? null);
  }, [session?.apiToken]);

  return <>{children}</>;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      <TokenSync>{children}</TokenSync>
    </NextAuthSessionProvider>
  );
}
