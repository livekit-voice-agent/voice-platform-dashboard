"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Bot,
  Cpu,
  Rocket,
  Phone,
  Route,
  DoorOpen,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const navItems = [
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/agent/deployments", label: "Deployments", icon: Rocket },
  { href: "/workers", label: "Workers", icon: Cpu },
];

const telephonyItems = [
  { href: "/telephony/sip-trunks", label: "SIP Trunks", icon: Phone },
  { href: "/telephony/dispatch-rules", label: "Dispatch Rules", icon: Route },
  { href: "/telephony/rooms", label: "Rooms", icon: DoorOpen },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
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
          <span>Voice Platform</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href + "/"));
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
              {item.label}
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
            Telephony
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
                    {item.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
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
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <SidebarContent onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
