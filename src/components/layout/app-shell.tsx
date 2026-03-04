"use client";

import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, MobileSidebar } from "./sidebar";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b px-4 md:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
          <span className="text-sm font-semibold">Voice Platform</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
