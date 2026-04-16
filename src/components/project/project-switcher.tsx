"use client";

import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProject } from "./project-provider";

export function ProjectSwitcher() {
  const t = useTranslations("project");
  const { projects, currentProject, setCurrentProject, isLoading } =
    useProject();

  if (isLoading) {
    return (
      <div className="px-6 py-2">
        <p className="text-[10px] text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-6 py-2">
        <p className="text-[10px] text-muted-foreground">{t("noProjects")}</p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2">
      <label className="mb-1 flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-3">
        <FolderOpen className="h-3 w-3" />
        {t("switcher")}
      </label>
      <Select
        value={currentProject?.id ?? ""}
        onValueChange={(id) => {
          const project = projects.find((p) => p.id === id);
          if (project) setCurrentProject(project);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("select")} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
