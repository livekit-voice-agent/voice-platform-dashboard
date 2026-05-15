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
  Activity,
  Users,
  FolderKanban,
  BarChart3,
} from "lucide-react";
import { useIsSuperAdmin } from "@/lib/auth-utils";
import { ProviderStatusWidget } from "./provider-status-widget";
import { ProjectSwitcher } from "@/components/project/project-switcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const agentItems = [
  { href: "/agent" as const, labelKey: "agent" as const, icon: Bot },
];

const telephonyItems = [
  { href: "/telephony/rooms" as const, labelKey: "rooms" as const, icon: DoorOpen },
  { href: "/telephony/sip-trunks" as const, labelKey: "sipTrunks" as const, icon: Phone },
  { href: "/telephony/dispatch-rules" as const, labelKey: "dispatchRules" as const, icon: Route },
];

const infraItems = [
  { href: "/workers" as const, labelKey: "workers" as const, icon: Cpu },
  { href: "/providers" as const, labelKey: "providers" as const, icon: Activity },
  { href: "/monitor" as const, labelKey: "monitor" as const, icon: BarChart3 },
];

const adminItems = [
  { href: "/admin/users" as const, labelKey: "adminUsers" as const, icon: Users },
  { href: "/admin/projects" as const, labelKey: "adminProjects" as const, icon: FolderKanban },
];

type NavSection = {
  labelKey: string;
  items: readonly { href: string; labelKey: string; icon: React.ComponentType<{ className?: string }> }[];
};

function NavItem({
  item,
  isActive,
  onNavigate,
  t,
}: {
  item: { href: string; labelKey: string; icon: React.ComponentType<{ className?: string }> };
  isActive: boolean;
  onNavigate?: () => void;
  t: (key: string) => string;
}) {
  return (
    <Link
      href={item.href as "/agent"}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-muted text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
      )}
    >
      <item.icon className="h-4 w-4" />
      {t(item.labelKey)}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("sidebar");
  const isSuperAdmin = useIsSuperAdmin();

  const allItems = [...agentItems, ...telephonyItems, ...infraItems, ...adminItems];

  const isItemActive = (href: string) => {
    const hasMoreSpecificMatch = allItems.some(
      (other) =>
        other.href !== href &&
        other.href.startsWith(href + "/") &&
        (pathname === other.href || pathname.startsWith(other.href + "/"))
    );
    return (
      !hasMoreSpecificMatch &&
      (pathname === href || (href !== "/" && pathname.startsWith(href + "/")))
    );
  };

  const sections: NavSection[] = [
    { labelKey: "agent", items: agentItems },
    { labelKey: "telephony", items: telephonyItems },
    { labelKey: "infrastructure", items: infraItems },
  ];

  if (isSuperAdmin) {
    sections.push({ labelKey: "admin", items: adminItems });
  }

  return (
    <>
      {/* Brand */}
      <div className="px-6 pt-5 pb-1">
        <Link
          href="/agent"
          className="flex items-center gap-1.5"
          onClick={onNavigate}
        >
          <span className="text-base font-semibold tracking-tight">VP</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">dashboard</span>
        </Link>
      </div>

      {/* Project Switcher */}
      <ProjectSwitcher />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
        {sections.map((section) => (
          <div key={section.labelKey}>
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3 mb-1.5">
              {t(section.labelKey)}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={isItemActive(item.href)}
                  onNavigate={onNavigate}
                  t={t}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Provider Status */}
      <ProviderStatusWidget />
    </>
  );
}

export function Sidebar() {
  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-card shrink-0">
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
      <SheetContent side="left" className="w-56 p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("navigation")}</SheetTitle>
        </SheetHeader>
        <SidebarContent onNavigate={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
