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
      <div className="px-6 py-3">
        <p className="text-xs text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="px-6 py-3">
        <p className="text-xs text-muted-foreground">{t("noProjects")}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3">
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <FolderOpen className="h-3.5 w-3.5" />
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
