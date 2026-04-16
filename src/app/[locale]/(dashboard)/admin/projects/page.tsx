"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  UserPlus,
  X,
  FolderKanban,
  Users,
  Loader2,
} from "lucide-react";

import { projectApi, userApi, type Project, type UserProfile } from "@/lib/api";
import { useIsSuperAdmin } from "@/lib/auth-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProjectMember {
  user_id: string;
  role: string;
  user?: { id: string; name?: string | null; email: string };
}

export default function AdminProjectsPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const isSuperAdmin = useIsSuperAdmin();

  const [projects, setProjects] = useState<Project[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [updating, setUpdating] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteProject, setDeleteProject] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Members
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberForm, setAddMemberForm] = useState({
    user_id: "",
    role: "VIEWER",
  });
  const [addingMember, setAddingMember] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const data = await projectApi.list();
      setProjects(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const data = await userApi.listAll();
      setAllUsers(data);
    } catch {
      // Users list is supplementary, don't block on error
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchProjects();
      fetchUsers();
    }
  }, [isSuperAdmin, fetchProjects, fetchUsers]);

  const fetchMembers = useCallback(async (projectId: string) => {
    try {
      setLoadingMembers(true);
      const data = await projectApi.listMembers(projectId);
      setMembers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load members");
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  const toggleExpand = (projectId: string) => {
    if (expandedProject === projectId) {
      setExpandedProject(null);
      setMembers([]);
    } else {
      setExpandedProject(projectId);
      fetchMembers(projectId);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">
            You need super admin privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      setCreating(true);
      await projectApi.create(createForm);
      toast.success("Project created");
      setCreateOpen(false);
      setCreateForm({ name: "", description: "" });
      fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (project: Project) => {
    setEditProject(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editProject) return;
    try {
      setUpdating(true);
      await projectApi.update(editProject.id, editForm);
      toast.success("Project updated");
      setEditOpen(false);
      fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update project");
    } finally {
      setUpdating(false);
    }
  };

  const openDelete = (project: Project) => {
    setDeleteProject(project);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteProject) return;
    try {
      setDeleting(true);
      await projectApi.delete(deleteProject.id);
      toast.success("Project deleted");
      setDeleteOpen(false);
      if (expandedProject === deleteProject.id) {
        setExpandedProject(null);
        setMembers([]);
      }
      fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  const handleAddMember = async () => {
    if (!expandedProject) return;
    try {
      setAddingMember(true);
      await projectApi.addMember(expandedProject, addMemberForm);
      toast.success("Member added");
      setAddMemberOpen(false);
      setAddMemberForm({ user_id: "", role: "VIEWER" });
      fetchMembers(expandedProject);
      fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleChangeRole = async (
    projectId: string,
    userId: string,
    role: string
  ) => {
    try {
      await projectApi.updateMemberRole(projectId, userId, role);
      toast.success("Role updated");
      fetchMembers(projectId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleRemoveMember = async (projectId: string, userId: string) => {
    try {
      await projectApi.removeMember(projectId, userId);
      toast.success("Member removed");
      fetchMembers(projectId);
      fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("projects.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("projects.description")}</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3 w-3" />
          {t("projects.create")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("projects.title")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{projects.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <Users className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("projects.members")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">
            {projects.reduce((acc, p) => acc + (p._count?.members ?? 0), 0)}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("projects.noProjects")}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[40px]" />
                <TableHead className="text-xs font-medium">{t("projects.name")}</TableHead>
                <TableHead className="text-xs font-medium">{t("projects.slug")}</TableHead>
                <TableHead className="text-xs font-medium">{t("projects.description")}</TableHead>
                <TableHead className="text-xs font-medium">{t("projects.members")}</TableHead>
                <TableHead className="text-xs font-medium">{tc("created")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <>
                  <TableRow key={project.id} className="group">
                    <TableCell>
                      <button
                        className="p-1 rounded hover:bg-muted"
                        onClick={() => toggleExpand(project.id)}
                      >
                        {expandedProject === project.id ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {project.name}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
                        {project.slug}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {project.description || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {project._count?.members ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {project.created_at
                        ? new Date(project.created_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          className="p-1 rounded hover:bg-muted"
                          onClick={() => openEdit(project)}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          className="p-1 rounded hover:bg-red-50"
                          onClick={() => openDelete(project)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-400" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Members Section */}
                  {expandedProject === project.id && (
                    <TableRow key={`${project.id}-members`}>
                      <TableCell colSpan={7} className="bg-muted/30 p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">
                              {t("projects.members")}
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs"
                              onClick={() => setAddMemberOpen(true)}
                            >
                              <UserPlus className="h-3 w-3" />
                              {t("projects.addMember")}
                            </Button>
                          </div>

                          {loadingMembers ? (
                            <div className="flex items-center justify-center py-4">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          ) : members.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("projects.noMembers")}
                            </p>
                          ) : (
                            <div className="rounded-md border bg-card overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                                    <TableHead className="text-xs font-medium">{t("users.name")}</TableHead>
                                    <TableHead className="text-xs font-medium">{t("users.email")}</TableHead>
                                    <TableHead className="text-xs font-medium">{t("projects.role")}</TableHead>
                                    <TableHead className="w-[60px]" />
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {members.map((member) => (
                                    <TableRow key={member.user_id} className="group/member">
                                      <TableCell className="text-sm">
                                        {member.user?.name || "—"}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {member.user?.email || "—"}
                                      </TableCell>
                                      <TableCell>
                                        <Select
                                          value={member.role}
                                          onValueChange={(value) =>
                                            handleChangeRole(
                                              project.id,
                                              member.user_id,
                                              value
                                            )
                                          }
                                        >
                                          <SelectTrigger className="w-[120px] h-7 text-xs">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="ADMIN">Admin</SelectItem>
                                            <SelectItem value="EDITOR">Editor</SelectItem>
                                            <SelectItem value="VIEWER">Viewer</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </TableCell>
                                      <TableCell>
                                        <button
                                          className="p-1 rounded hover:bg-red-50 opacity-0 group-hover/member:opacity-100 transition-opacity"
                                          onClick={() =>
                                            handleRemoveMember(
                                              project.id,
                                              member.user_id
                                            )
                                          }
                                        >
                                          <X className="h-3.5 w-3.5 text-red-400" />
                                        </button>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2.5 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {projects.length} {projects.length === 1 ? "project" : "projects"}
            </span>
          </div>
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                <FolderKanban className="h-3.5 w-3.5 text-violet-600" />
              </span>
              {t("projects.create")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="create-project-name" className="text-xs font-medium mb-1 block">{t("projects.name")}</label>
              <Input
                id="create-project-name"
                className="h-8"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="create-project-desc" className="text-xs font-medium mb-1 block">
                {t("projects.description")} <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="create-project-desc"
                className="h-8"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={creating || !createForm.name}>
              {creating ? tc("saving") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50">
                <Pencil className="h-3.5 w-3.5 text-violet-600" />
              </span>
              {t("projects.edit")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="edit-project-name" className="text-xs font-medium mb-1 block">{t("projects.name")}</label>
              <Input
                id="edit-project-name"
                className="h-8"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="edit-project-desc" className="text-xs font-medium mb-1 block">
                {t("projects.description")} <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="edit-project-desc"
                className="h-8"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setEditOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleEdit} disabled={updating}>
              {updating ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </span>
              {t("projects.delete")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              {t("projects.deleteConfirm")}
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleDelete} disabled={deleting}>
              {deleting ? tc("loading") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50">
                <UserPlus className="h-3.5 w-3.5 text-blue-600" />
              </span>
              {t("projects.addMember")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label className="text-xs font-medium mb-1 block">{t("projects.selectUser")}</label>
              <Select
                value={addMemberForm.user_id}
                onValueChange={(value) => setAddMemberForm({ ...addMemberForm, user_id: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("projects.selectUser")} />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u) => !members.some((m) => m.user_id === u.id))
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">{t("projects.selectRole")}</label>
              <Select
                value={addMemberForm.role}
                onValueChange={(value) => setAddMemberForm({ ...addMemberForm, role: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={t("projects.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="EDITOR">Editor</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setAddMemberOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleAddMember} disabled={addingMember || !addMemberForm.user_id}>
              {addingMember ? tc("saving") : tc("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
