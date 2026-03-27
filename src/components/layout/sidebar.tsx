"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  Bot,
  Cpu,
  Phone,
  Route,
  DoorOpen,
  ChevronDown,
  Activity,
} from "lucide-react";
import { useState } from "react";
import { ProviderStatusWidget } from "./provider-status-widget";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/agent" as const, labelKey: "agent" as const, icon: Bot },
  { href: "/workers" as const, labelKey: "workers" as const, icon: Cpu },
  { href: "/providers" as const, labelKey: "providers" as const, icon: Activity },
];

const telephonyItems = [
  { href: "/telephony/sip-trunks" as const, labelKey: "sipTrunks" as const, icon: Phone },
  { href: "/telephony/dispatch-rules" as const, labelKey: "dispatchRules" as const, icon: Route },
  { href: "/telephony/rooms" as const, labelKey: "rooms" as const, icon: DoorOpen },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const [telephonyOpen, setTelephonyOpen] = useState(
    pathname.startsWith("/telephony")
  );

  return (
    <>
      <div className="flex h-14 items-center border-b px-6">
        <Link
          href="/agent"
          className="flex items-center gap-2 font-semibold"
          onClick={onNavigate}
        >
          <Bot className="h-6 w-6" />
          <span>{t("brand")}</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const hasMoreSpecificMatch = navItems.some(
            (other) =>
              other.href !== item.href &&
              other.href.startsWith(item.href + "/") &&
              (pathname === other.href || pathname.startsWith(other.href + "/"))
          );
          const isActive =
            !hasMoreSpecificMatch &&
            (pathname === item.href ||
              ((item.href as string) !== "/" && pathname.startsWith(item.href + "/")));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}

        {/* Telephony Section */}
        <div className="pt-3">
          <button
            onClick={() => setTelephonyOpen(!telephonyOpen)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Phone className="h-4 w-4" />
            {t("telephony")}
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 transition-transform",
                telephonyOpen && "rotate-180"
              )}
            />
          </button>
          {telephonyOpen && (
            <div className="ml-4 space-y-1 border-l pl-3 mt-1">
              {telephonyItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
      <ProviderStatusWidget />
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-muted/40">
      <SidebarContent />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("sidebar");
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("navigation")}</SheetTitle>
        </SheetHeader>
        <SidebarContent onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
