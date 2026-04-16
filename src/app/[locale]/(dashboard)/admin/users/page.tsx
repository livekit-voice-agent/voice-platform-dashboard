"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Loader2,
  Pencil,
  Plus,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";

import { userApi, type UserProfile } from "@/lib/api";
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

function RoleBadge({ isAdmin }: { isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
        <Shield className="h-2.5 w-2.5" />
        Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
      User
    </span>
  );
}

export default function AdminUsersPage() {
  const t = useTranslations("admin");
  const tc = useTranslations("common");
  const isSuperAdmin = useIsSuperAdmin();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    password: "",
    is_super_admin: false,
  });
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editForm, setEditForm] = useState({ name: "", is_super_admin: false });
  const [updating, setUpdating] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await userApi.listAll();
      setUsers(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) fetchUsers();
  }, [isSuperAdmin, fetchUsers]);

  const stats = useMemo(() => {
    const admins = users.filter((u) => u.is_super_admin).length;
    return { total: users.length, admins, regular: users.length - admins };
  }, [users]);

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-2">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            You need super admin privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  const handleCreate = async () => {
    try {
      setCreating(true);
      await userApi.create(createForm);
      toast.success("User created");
      setCreateOpen(false);
      setCreateForm({ name: "", email: "", password: "", is_super_admin: false });
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (user: UserProfile) => {
    setEditUser(user);
    setEditForm({ name: user.name || "", is_super_admin: user.is_super_admin });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      setUpdating(true);
      await userApi.update(editUser.id, editForm);
      toast.success("User updated");
      setEditOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setUpdating(false);
    }
  };

  const openDelete = (user: UserProfile) => {
    setDeleteUser(user);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      setDeleting(true);
      await userApi.delete(deleteUser.id);
      toast.success("User deleted");
      setDeleteOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("users.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("users.description")}</p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="h-3 w-3" />
          {t("users.create")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <Users className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("users.title")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
              <Shield className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Admins</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.admins}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100">
              <User className="h-3.5 w-3.5 text-zinc-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Regular Users</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.regular}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("users.noUsers")}</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-medium">{t("users.name")}</TableHead>
                <TableHead className="text-xs font-medium">{t("users.email")}</TableHead>
                <TableHead className="text-xs font-medium">Role</TableHead>
                <TableHead className="text-xs font-medium">{t("users.createdAt")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} className="group">
                  <TableCell className="font-medium text-sm">
                    {user.name || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <RoleBadge isAdmin={user.is_super_admin} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.memberships ? "—" : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-muted"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-destructive/10"
                        onClick={() => openDelete(user)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2.5 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {users.length} {users.length === 1 ? "user" : "users"}
            </span>
          </div>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
                <UserPlus className="h-3.5 w-3.5 text-rose-600" />
              </span>
              {t("users.create")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="create-name" className="text-xs font-medium mb-1 block">
                {t("users.name")} <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input
                id="create-name"
                className="h-8"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="create-email" className="text-xs font-medium mb-1 block">{t("users.email")}</label>
              <Input
                id="create-email"
                type="email"
                className="h-8"
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="create-password" className="text-xs font-medium mb-1 block">{t("users.password")}</label>
              <Input
                id="create-password"
                type="password"
                className="h-8"
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              />
            </div>
            <label htmlFor="create-super-admin" className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <div>
                <span className="text-xs font-medium">{t("users.superAdmin")}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Full access to all projects and settings</p>
              </div>
              <input
                id="create-super-admin"
                type="checkbox"
                checked={createForm.is_super_admin}
                onChange={(e) => setCreateForm({ ...createForm, is_super_admin: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-foreground"
              />
            </label>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCreateOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleCreate} disabled={creating || !createForm.email || !createForm.password}>
              {creating ? tc("saving") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
                <Pencil className="h-3.5 w-3.5 text-rose-600" />
              </span>
              {t("users.edit")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="edit-name" className="text-xs font-medium mb-1 block">{t("users.name")}</label>
              <Input
                id="edit-name"
                className="h-8"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <label htmlFor="edit-super-admin" className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <div>
                <span className="text-xs font-medium">{t("users.superAdmin")}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Full access to all projects and settings</p>
              </div>
              <input
                id="edit-super-admin"
                type="checkbox"
                checked={editForm.is_super_admin}
                onChange={(e) => setEditForm({ ...editForm, is_super_admin: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300 accent-foreground"
              />
            </label>
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
              {t("users.delete")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              {t("users.deleteConfirm")}
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? tc("loading") : tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
