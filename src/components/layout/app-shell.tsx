"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar, MobileSidebar } from "./sidebar";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const t = useTranslations("sidebar");
  const tc = useTranslations("common");

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      <MobileSidebar open={mobileOpen} onOpenChange={setMobileOpen} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">{tc("openMenu")}</span>
          </Button>
          <span className="text-sm font-semibold md:hidden">{t("brand")}</span>
          <div className="ml-auto">
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>

      <Toaster />
    </div>
  );
}
