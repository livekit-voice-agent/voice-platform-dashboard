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
} from "lucide-react";

import { projectApi, userApi, type Project, type UserProfile } from "@/lib/api";
import { useIsSuperAdmin } from "@/lib/auth-utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("projects.title")}</h1>
          <p className="text-muted-foreground">{t("projects.description")}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("projects.create")}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{tc("loading")}</p>
      ) : projects.length === 0 ? (
        <p className="text-muted-foreground">{t("projects.noProjects")}</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]" />
                <TableHead>{t("projects.name")}</TableHead>
                <TableHead>{t("projects.slug")}</TableHead>
                <TableHead>{t("projects.description")}</TableHead>
                <TableHead>{t("projects.members")}</TableHead>
                <TableHead>{tc("created")}</TableHead>
                <TableHead className="w-[100px]">{tc("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <>
                  <TableRow key={project.id}>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleExpand(project.id)}
                      >
                        {expandedProject === project.id ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                    <TableCell className="font-medium">
                      {project.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{project.slug}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {project.description || "—"}
                    </TableCell>
                    <TableCell>
                      {project._count?.members ?? "—"}
                    </TableCell>
                    <TableCell>
                      {project.created_at
                        ? new Date(project.created_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(project)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDelete(project)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Members Section */}
                  {expandedProject === project.id && (
                    <TableRow key={`${project.id}-members`}>
                      <TableCell colSpan={7} className="bg-muted/50 p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">
                              {t("projects.members")}
                            </h4>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setAddMemberOpen(true)}
                            >
                              <UserPlus className="mr-2 h-3 w-3" />
                              {t("projects.addMember")}
                            </Button>
                          </div>

                          {loadingMembers ? (
                            <p className="text-sm text-muted-foreground">
                              {tc("loading")}
                            </p>
                          ) : members.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              {t("projects.noMembers")}
                            </p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("users.name")}</TableHead>
                                  <TableHead>{t("users.email")}</TableHead>
                                  <TableHead>{t("projects.role")}</TableHead>
                                  <TableHead className="w-[80px]">
                                    {tc("actions")}
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {members.map((member) => (
                                  <TableRow key={member.user_id}>
                                    <TableCell>
                                      {member.user?.name || "—"}
                                    </TableCell>
                                    <TableCell>
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
                                        <SelectTrigger className="w-[130px] h-8">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="ADMIN">
                                            Admin
                                          </SelectItem>
                                          <SelectItem value="EDITOR">
                                            Editor
                                          </SelectItem>
                                          <SelectItem value="VIEWER">
                                            Viewer
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() =>
                                          handleRemoveMember(
                                            project.id,
                                            member.user_id
                                          )
                                        }
                                      >
                                        <X className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-project-name">
                {t("projects.name")}
              </Label>
              <Input
                id="create-project-name"
                value={createForm.name}
                onChange={(e) =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-project-desc">
                {t("projects.description")}
              </Label>
              <Input
                id="create-project-desc"
                value={createForm.description}
                onChange={(e) =>
                  setCreateForm({ ...createForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !createForm.name}
            >
              {creating ? tc("saving") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.edit")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-project-name">
                {t("projects.name")}
              </Label>
              <Input
                id="edit-project-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-project-desc">
                {t("projects.description")}
              </Label>
              <Input
                id="edit-project-desc"
                value={editForm.description}
                onChange={(e) =>
                  setEditForm({ ...editForm, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleEdit} disabled={updating}>
              {updating ? tc("saving") : tc("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.delete")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("projects.deleteConfirm")}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? tc("loading") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("projects.addMember")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("projects.selectUser")}</Label>
              <Select
                value={addMemberForm.user_id}
                onValueChange={(value) =>
                  setAddMemberForm({ ...addMemberForm, user_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("projects.selectUser")} />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter(
                      (u) =>
                        !members.some((m) => m.user_id === u.id)
                    )
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email} ({user.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("projects.selectRole")}</Label>
              <Select
                value={addMemberForm.role}
                onValueChange={(value) =>
                  setAddMemberForm({ ...addMemberForm, role: value })
                }
              >
                <SelectTrigger>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddMemberOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addingMember || !addMemberForm.user_id}
            >
              {addingMember ? tc("saving") : tc("add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
