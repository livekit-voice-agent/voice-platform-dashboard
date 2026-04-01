"use client";

import { useSession } from "next-auth/react";

export function useIsSuperAdmin(): boolean {
  const { data: session } = useSession();
  return session?.user?.isSuperAdmin ?? false;
}
