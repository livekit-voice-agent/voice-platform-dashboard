"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ProjectProvider } from "@/components/project/project-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProjectProvider>
      <AppShell>{children}</AppShell>
    </ProjectProvider>
  );
}
