"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import {
  projectApi,
  setCurrentProjectId,
  getCurrentProjectId,
  type Project,
} from "@/lib/api";
import type { ProjectRole } from "./role-utils";

interface ProjectContextValue {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (project: Project) => void;
  userRole: ProjectRole | null;
  isLoading: boolean;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(
    null,
  );
  const [userRole, setUserRole] = useState<ProjectRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch projects on mount
  useEffect(() => {
    if (!session?.apiToken) return;

    let cancelled = false;

    async function fetchProjects() {
      try {
        const data = await projectApi.list();
        if (cancelled) return;

        setProjects(data);

        const savedId = getCurrentProjectId();
        const saved = savedId ? data.find((p) => p.id === savedId) : null;
        const initial = saved ?? data[0] ?? null;

        if (initial) {
          setCurrentProjectState(initial);
          setCurrentProjectId(initial.id);
        }
      } catch {
        // API error — leave empty
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [session?.apiToken]);

  // Fetch user role when project changes
  useEffect(() => {
    if (!currentProject || !session?.user?.id) {
      setUserRole(null);
      return;
    }

    if (session.user.isSuperAdmin) {
      setUserRole("ADMIN");
      return;
    }

    let cancelled = false;

    async function fetchRole() {
      try {
        const members = await projectApi.listMembers(currentProject!.id);
        if (cancelled) return;

        const me = members.find(
          (m: { user_id?: string; userId?: string }) =>
            m.user_id === session!.user.id || m.userId === session!.user.id,
        );
        setUserRole(
          me ? ((me.role?.toUpperCase() as ProjectRole) ?? "VIEWER") : null,
        );
      } catch {
        if (!cancelled) setUserRole(null);
      }
    }

    fetchRole();
    return () => {
      cancelled = true;
    };
  }, [currentProject, session]);

  const setCurrentProject = useCallback((project: Project) => {
    setCurrentProjectState(project);
    setCurrentProjectId(project.id);
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      currentProject,
      setCurrentProject,
      userRole,
      isLoading,
    }),
    [projects, currentProject, setCurrentProject, userRole, isLoading],
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return ctx;
}
