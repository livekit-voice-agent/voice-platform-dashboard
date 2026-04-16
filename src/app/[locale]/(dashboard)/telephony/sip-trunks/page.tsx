"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  sipTrunkApi,
  type SipInboundTrunk,
  type CreateSipTrunkRequest,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Phone, Plus, Pencil, Trash2, Loader2, X, ArrowRight, Link2, Mic } from "lucide-react";

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

  const [formName, setFormName] = useState("");
  const [formNumbers, setFormNumbers] = useState("");
  const [formAllowedNumbers, setFormAllowedNumbers] = useState("");
  const [formAllowedAddresses, setFormAllowedAddresses] = useState("");
  const [formKrispEnabled, setFormKrispEnabled] = useState(false);
  const [formMetadata, setFormMetadata] = useState("");
  const [formHeaderMappings, setFormHeaderMappings] = useState<
    { header: string; attribute: string }[]
  >([]);

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

  const stats = useMemo(() => {
    const total = trunks.length;
    const withKrisp = trunks.filter((t) => t.krispEnabled).length;
    const withMappings = trunks.filter(
      (t) => t.headersToAttributes && Object.keys(t.headersToAttributes).length > 0
    ).length;
    return { total, withKrisp, withMappings };
  }, [trunks]);

  const resetForm = () => {
    setFormName("");
    setFormNumbers("");
    setFormAllowedNumbers("");
    setFormAllowedAddresses("");
    setFormKrispEnabled(false);
    setFormMetadata("");
    setFormHeaderMappings([]);
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
          headersToAttributes:
            formHeaderMappings.length > 0
              ? Object.fromEntries(
                  formHeaderMappings
                    .filter((m) => m.header.trim() && m.attribute.trim())
                    .map((m) => [m.header.trim(), m.attribute.trim()])
                )
              : undefined,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("description")}</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openCreateDialog}>
          <Plus className="h-3 w-3" />
          {t("createTrunk")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <Phone className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("inboundTrunks")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50">
              <Mic className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Krisp</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.withKrisp}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
              <Link2 className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("tableHeaderMappings")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.withMappings}</p>
        </div>
      </div>

      {/* Table */}
      {trunks.length > 0 ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-medium">{t("tableName")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableNumbers")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableKrisp")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableHeaderMappings")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableTrunkId")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {trunks.map((trunk) => (
                <TableRow key={trunk.sipTrunkId} className="group">
                  <TableCell className="font-medium text-sm">
                    {trunk.name || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(trunk.numbers || []).map((n) => (
                        <span
                          key={n}
                          className="inline-flex items-center rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {trunk.krispEnabled ? (
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
                        Enabled
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {trunk.headersToAttributes &&
                    Object.keys(trunk.headersToAttributes).length > 0 ? (
                      <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                        {Object.keys(trunk.headersToAttributes).length}{" "}
                        {Object.keys(trunk.headersToAttributes).length === 1
                          ? "mapping"
                          : "mappings"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {trunk.sipTrunkId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-muted"
                        onClick={() => openEditDialog(trunk)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(trunk.sipTrunkId)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="border-t px-4 py-2.5 bg-muted/20">
            <span className="text-xs text-muted-foreground">
              {stats.total} {stats.total === 1 ? "trunk" : "trunks"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Phone className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("noTrunksFound")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("createFirstTrunk")}</p>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50">
                {editingTrunk ? <Pencil className="h-3.5 w-3.5 text-sky-600" /> : <Phone className="h-3.5 w-3.5 text-sky-600" />}
              </span>
              {editingTrunk ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {editingTrunk ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Identity section */}
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Identity</div>
            <div>
              <label htmlFor="name" className="text-xs font-medium mb-1 block">{t("tableName")}</label>
              <Input
                id="name"
                className="h-8"
                placeholder={t("namePlaceholder")}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {!editingTrunk && (
              <>
                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Phone Numbers</div>
                <div>
                  <label htmlFor="numbers" className="text-xs font-medium mb-1 block">
                    {t("phoneNumbers")} <span className="text-muted-foreground font-normal">{t("phoneNumbersHint")}</span>
                  </label>
                  <Input
                    id="numbers"
                    className="h-8 font-mono text-xs"
                    placeholder="+15105550100, +15105550101"
                    value={formNumbers}
                    onChange={(e) => setFormNumbers(e.target.value)}
                  />
                </div>

                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Security</div>
                <div>
                  <label htmlFor="allowedNumbers" className="text-xs font-medium mb-1 block">
                    {t("allowedNumbers")} <span className="text-muted-foreground font-normal">{t("allowedNumbersHint")}</span>
                  </label>
                  <Input
                    id="allowedNumbers"
                    className="h-8 font-mono text-xs"
                    placeholder="+13105550100"
                    value={formAllowedNumbers}
                    onChange={(e) => setFormAllowedNumbers(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="allowedAddresses" className="text-xs font-medium mb-1 block">
                    {t("allowedAddresses")} <span className="text-muted-foreground font-normal">{t("allowedAddressesHint")}</span>
                  </label>
                  <Input
                    id="allowedAddresses"
                    className="h-8 font-mono text-xs"
                    placeholder="192.168.1.10"
                    value={formAllowedAddresses}
                    onChange={(e) => setFormAllowedAddresses(e.target.value)}
                  />
                </div>

                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Options</div>
                <label htmlFor="krispEnabled" className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <div>
                    <span className="text-xs font-medium">{t("enableKrisp")}</span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">AI-powered noise cancellation for calls</p>
                  </div>
                  <input
                    type="checkbox"
                    id="krispEnabled"
                    checked={formKrispEnabled}
                    onChange={(e) => setFormKrispEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-foreground"
                  />
                </label>
              </>
            )}

            <div className="border-t" />
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Metadata</div>
            <div>
              <label htmlFor="metadata" className="text-xs font-medium mb-1 block">
                {tc("metadataOptional")}
              </label>
              <Input
                id="metadata"
                className="h-8 font-mono text-xs"
                placeholder='{"team": "sales"}'
                value={formMetadata}
                onChange={(e) => setFormMetadata(e.target.value)}
              />
            </div>

            {/* Header Mappings */}
            {!editingTrunk ? (
              <>
                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("headerMappings")} <span className="font-normal normal-case">{t("headerMappingsHint")}</span>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[1fr_28px_1fr_32px] gap-0 items-center bg-muted/40 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span>SIP Header</span>
                    <span />
                    <span>Attribute</span>
                    <span />
                  </div>
                  {formHeaderMappings.map((mapping, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_28px_1fr_32px] gap-0 items-center px-3 py-1.5 border-t group">
                      <Input
                        placeholder="X-Customer-Id"
                        value={mapping.header}
                        onChange={(e) => {
                          const updated = [...formHeaderMappings];
                          updated[idx] = { ...updated[idx], header: e.target.value };
                          setFormHeaderMappings(updated);
                        }}
                        className="h-7 text-xs font-mono border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                      />
                      <ArrowRight className="h-3 w-3 text-muted-foreground mx-auto" />
                      <Input
                        placeholder="customer_id"
                        value={mapping.attribute}
                        onChange={(e) => {
                          const updated = [...formHeaderMappings];
                          updated[idx] = { ...updated[idx], attribute: e.target.value };
                          setFormHeaderMappings(updated);
                        }}
                        className="h-7 text-xs font-mono border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                      />
                      <button
                        className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity mx-auto"
                        type="button"
                        onClick={() => setFormHeaderMappings(formHeaderMappings.filter((_, i) => i !== idx))}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="w-full border-t px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5"
                    onClick={() => setFormHeaderMappings([...formHeaderMappings, { header: "", attribute: "" }])}
                  >
                    <Plus className="h-3 w-3" />
                    {t("addMapping")}
                  </button>
                </div>
              </>
            ) : editingTrunk.headersToAttributes &&
              Object.keys(editingTrunk.headersToAttributes).length > 0 ? (
              <>
                <div className="border-t" />
                <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("headerMappings")} <span className="font-normal normal-case">{t("headerMappingsReadonly")}</span>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <div className="grid grid-cols-[1fr_28px_1fr] gap-0 items-center bg-muted/40 px-3 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span>SIP Header</span>
                    <span />
                    <span>Attribute</span>
                  </div>
                  {Object.entries(editingTrunk.headersToAttributes).map(
                    ([header, attr]) => (
                      <div key={header} className="grid grid-cols-[1fr_28px_1fr] gap-0 items-center px-3 py-1.5 border-t">
                        <span className="text-xs font-mono">{header}</span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground mx-auto" />
                        <span className="text-xs font-mono">{attr}</span>
                      </div>
                    )
                  )}
                </div>
              </>
            ) : null}
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
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
        <DialogContent className="p-0 gap-0 sm:max-w-sm" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </span>
              {t("deleteTitle")}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <p className="text-sm text-muted-foreground">
              {t("deleteConfirmation")}
            </p>
          </div>
          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDeleteConfirmId(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
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
