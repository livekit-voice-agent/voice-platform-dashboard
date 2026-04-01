"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  sipTrunkApi,
  type SipInboundTrunk,
  type CreateSipTrunkRequest,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export default function SipTrunksPage() {
  const t = useTranslations("telephony.sipTrunks");
  const tc = useTranslations("common");
  const [trunks, setTrunks] = useState<SipInboundTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrunk, setEditingTrunk] = useState<SipInboundTrunk | null>(
    null
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNumbers, setFormNumbers] = useState("");
  const [formAllowedNumbers, setFormAllowedNumbers] = useState("");
  const [formAllowedAddresses, setFormAllowedAddresses] = useState("");
  const [formKrispEnabled, setFormKrispEnabled] = useState(false);
  const [formMetadata, setFormMetadata] = useState("");

  const fetchTrunks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sipTrunkApi.list();
      setTrunks(data);
    } catch (err: any) {
      toast.error(err.message || t("toastLoadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrunks();
  }, [fetchTrunks]);

  const resetForm = () => {
    setFormName("");
    setFormNumbers("");
    setFormAllowedNumbers("");
    setFormAllowedAddresses("");
    setFormKrispEnabled(false);
    setFormMetadata("");
    setEditingTrunk(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (trunk: SipInboundTrunk) => {
    setEditingTrunk(trunk);
    setFormName(trunk.name || "");
    setFormNumbers((trunk.numbers || []).join(", "));
    setFormAllowedNumbers((trunk.allowedNumbers || []).join(", "));
    setFormAllowedAddresses((trunk.allowedAddresses || []).join(", "));
    setFormKrispEnabled(trunk.krispEnabled || false);
    setFormMetadata(trunk.metadata || "");
    setDialogOpen(true);
  };

  const parseCommaSeparated = (val: string): string[] =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error(t("toastNameRequired"));
      return;
    }
    const numbers = parseCommaSeparated(formNumbers);
    // if (!editingTrunk && numbers.length === 0) {
    //   toast.error("At least one phone number is required");
    //   return;
    // }

    setSaving(true);
    try {
      if (editingTrunk) {
        await sipTrunkApi.update(editingTrunk.sipTrunkId, {
          name: formName,
          metadata: formMetadata || undefined,
        });
        toast.success(t("toastUpdated"));
      } else {
        const payload: CreateSipTrunkRequest = {
          name: formName,
          numbers,
          allowedNumbers: parseCommaSeparated(formAllowedNumbers),
          allowedAddresses: parseCommaSeparated(formAllowedAddresses),
          krispEnabled: formKrispEnabled,
          metadata: formMetadata || undefined,
        };
        await sipTrunkApi.create(payload);
        toast.success(t("toastCreated"));
      }
      setDialogOpen(false);
      resetForm();
      fetchTrunks();
    } catch (err: any) {
      toast.error(err.message || t("toastSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sipTrunkApi.delete(id);
      toast.success(t("toastDeleted"));
      setDeleteConfirmId(null);
      fetchTrunks();
    } catch (err: any) {
      toast.error(err.message || t("toastDeleteError"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("description")}
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createTrunk")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {t("inboundTrunks")}
          </CardTitle>
          <CardDescription>
            {t("inboundTrunksDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t("noTrunksFound")}</p>
              <p className="text-sm text-muted-foreground">
                {t("createFirstTrunk")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tableName")}</TableHead>
                  <TableHead>{t("tableNumbers")}</TableHead>
                  <TableHead>{t("tableAllowedNumbers")}</TableHead>
                  <TableHead>{t("tableKrisp")}</TableHead>
                  <TableHead>{t("tableTrunkId")}</TableHead>
                  <TableHead className="text-right">{t("tableActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trunks.map((trunk) => (
                  <TableRow key={trunk.sipTrunkId}>
                    <TableCell className="font-medium">
                      {trunk.name || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(trunk.numbers || []).map((n) => (
                          <Badge key={n} variant="secondary">
                            {n}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(trunk.allowedNumbers || []).length > 0
                          ? trunk.allowedNumbers.map((n) => (
                              <Badge key={n} variant="outline">
                                {n}
                              </Badge>
                            ))
                          : t("allAllowed")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={trunk.krispEnabled ? "default" : "secondary"}
                      >
                        {trunk.krispEnabled ? t("krispEnabled") : t("krispDisabled")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {trunk.sipTrunkId}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(trunk)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteConfirmId(trunk.sipTrunkId)
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTrunk ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingTrunk
                ? t("editDescription")
                : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">{t("tableName")}</Label>
              <Input
                id="name"
                placeholder={t("namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {!editingTrunk && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="numbers">
                    {t("phoneNumbers")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {t("phoneNumbersHint")}
                    </span>
                  </Label>
                  <Input
                    id="numbers"
                    placeholder="+15105550100, +15105550101"
                    value={formNumbers}
                    onChange={(e) => setFormNumbers(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowedNumbers">
                    {t("allowedNumbers")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {t("allowedNumbersHint")}
                    </span>
                  </Label>
                  <Input
                    id="allowedNumbers"
                    placeholder="+13105550100"
                    value={formAllowedNumbers}
                    onChange={(e) => setFormAllowedNumbers(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowedAddresses">
                    {t("allowedAddresses")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {t("allowedAddressesHint")}
                    </span>
                  </Label>
                  <Input
                    id="allowedAddresses"
                    placeholder="192.168.1.10"
                    value={formAllowedAddresses}
                    onChange={(e) => setFormAllowedAddresses(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="krispEnabled"
                    checked={formKrispEnabled}
                    onChange={(e) => setFormKrispEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="krispEnabled">
                    {t("enableKrisp")}
                  </Label>
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="metadata">
                {tc("metadataOptional")}
              </Label>
              <Input
                id="metadata"
                placeholder='{"team": "sales"}'
                value={formMetadata}
                onChange={(e) => setFormMetadata(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTrunk ? tc("update") : tc("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteConfirmation")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
