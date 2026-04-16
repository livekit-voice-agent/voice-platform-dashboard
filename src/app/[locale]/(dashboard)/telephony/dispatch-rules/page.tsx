"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  dispatchRuleApi,
  sipTrunkApi,
  type DispatchRuleInfo,
  type CreateDispatchRuleRequest,
  type SipInboundTrunk,
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
import { Route, Plus, Pencil, Trash2, Loader2, GitBranch, Bot } from "lucide-react";

function getRuleType(rule: DispatchRuleInfo): string {
  if (rule.rule?.dispatchRuleDirect) return "direct";
  if (rule.rule?.dispatchRuleIndividual) return "individual";
  if (rule.rule?.dispatchRuleCallee) return "callee";
  return "unknown";
}

function getRuleTarget(rule: DispatchRuleInfo): string {
  if (rule.rule?.dispatchRuleDirect)
    return `Room: ${rule.rule.dispatchRuleDirect.roomName}`;
  if (rule.rule?.dispatchRuleIndividual)
    return `Prefix: ${rule.rule.dispatchRuleIndividual.roomPrefix}`;
  if (rule.rule?.dispatchRuleCallee)
    return `Prefix: ${rule.rule.dispatchRuleCallee.roomPrefix}`;
  return "—";
}

function getAgentName(rule: DispatchRuleInfo): string {
  const agents = rule.roomConfig?.agents;
  if (agents && agents.length > 0) return agents[0].agentName;
  return "—";
}

function RuleTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    individual: "border-blue-200 bg-blue-50 text-blue-700",
    direct: "border-amber-200 bg-amber-50 text-amber-700",
    callee: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${colors[type] || "border-zinc-200 bg-zinc-50 text-zinc-500"}`}
    >
      {type}
    </span>
  );
}

export default function DispatchRulesPage() {
  const t = useTranslations("telephony.dispatchRules");
  const tc = useTranslations("common");
  const [rules, setRules] = useState<DispatchRuleInfo[]>([]);
  const [trunks, setTrunks] = useState<SipInboundTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DispatchRuleInfo | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formRuleType, setFormRuleType] = useState<
    "individual" | "direct" | "callee"
  >("individual");
  const [formRoomPrefix, setFormRoomPrefix] = useState("");
  const [formRoomName, setFormRoomName] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formTrunkIds, setFormTrunkIds] = useState("");
  const [formAgentName, setFormAgentName] = useState("");
  const [formMetadata, setFormMetadata] = useState("");
  const [formHidePhoneNumber, setFormHidePhoneNumber] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [rulesData, trunksData] = await Promise.all([
        dispatchRuleApi.list(),
        sipTrunkApi.list().catch(() => [] as SipInboundTrunk[]),
      ]);
      setRules(rulesData);
      setTrunks(trunksData);
    } catch (err: any) {
      toast.error(err.message || t("toastSaveError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = rules.length;
    const individual = rules.filter((r) => getRuleType(r) === "individual").length;
    const direct = rules.filter((r) => getRuleType(r) === "direct").length;
    return { total, individual, direct };
  }, [rules]);

  const resetForm = () => {
    setFormName("");
    setFormRuleType("individual");
    setFormRoomPrefix("call-");
    setFormRoomName("");
    setFormPin("");
    setFormTrunkIds("");
    setFormAgentName("");
    setFormMetadata("");
    setFormHidePhoneNumber(false);
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (rule: DispatchRuleInfo) => {
    setEditingRule(rule);
    setFormName(rule.name || "");
    setFormMetadata(rule.metadata || "");
    setFormHidePhoneNumber(rule.hidePhoneNumber || false);
    setFormTrunkIds((rule.trunkIds || []).join(", "));
    setFormAgentName(getAgentName(rule));

    const type = getRuleType(rule);
    if (type === "direct") {
      setFormRuleType("direct");
      setFormRoomName(rule.rule?.dispatchRuleDirect?.roomName || "");
      setFormPin(rule.rule?.dispatchRuleDirect?.pin || "");
    } else if (type === "callee") {
      setFormRuleType("callee");
      setFormRoomPrefix(rule.rule?.dispatchRuleCallee?.roomPrefix || "");
    } else {
      setFormRuleType("individual");
      setFormRoomPrefix(rule.rule?.dispatchRuleIndividual?.roomPrefix || "");
      setFormPin(rule.rule?.dispatchRuleIndividual?.pin || "");
    }

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

    setSaving(true);
    try {
      if (editingRule) {
        const payload: CreateDispatchRuleRequest = {
          name: formName,
          ruleType: formRuleType,
          metadata: formMetadata || undefined,
          hidePhoneNumber: formHidePhoneNumber,
          trunkIds: parseCommaSeparated(formTrunkIds),
          agentName: formAgentName || undefined,
        };

        if (formRuleType === "direct") {
          payload.roomName = formRoomName;
          payload.pin = formPin || undefined;
        } else {
          payload.roomPrefix = formRoomPrefix || "call-";
          payload.pin = formPin || undefined;
        }

        await dispatchRuleApi.update(editingRule.sipDispatchRuleId, payload);
        toast.success(t("toastUpdated"));
      } else {
        const payload: CreateDispatchRuleRequest = {
          name: formName,
          ruleType: formRuleType,
          metadata: formMetadata || undefined,
          hidePhoneNumber: formHidePhoneNumber,
          trunkIds: parseCommaSeparated(formTrunkIds),
          agentName: formAgentName || undefined,
        };

        if (formRuleType === "direct") {
          payload.roomName = formRoomName;
          payload.pin = formPin || undefined;
        } else {
          payload.roomPrefix = formRoomPrefix || "call-";
          payload.pin = formPin || undefined;
        }

        await dispatchRuleApi.create(payload);
        toast.success(t("toastCreated"));
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || t("toastSaveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await dispatchRuleApi.delete(id);
      toast.success(t("toastDeleted"));
      setDeleteConfirmId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || t("toastDeleteError"));
    }
  };

  const trunkNameById = (id: string) => {
    const trunk = trunks.find((t) => t.sipTrunkId === id);
    return trunk?.name || id;
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
          {t("createRule")}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50">
              <Route className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">{t("cardTitle")}</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50">
              <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Individual</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.individual}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 hover:border-foreground/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50">
              <Bot className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Direct</span>
          </div>
          <p className="text-2xl font-semibold tracking-tight">{stats.direct}</p>
        </div>
      </div>

      {/* Table */}
      {rules.length > 0 ? (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-medium">{t("tableName")}</TableHead>
                <TableHead className="text-xs font-medium w-[100px]">{t("tableRuleType")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableTarget")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableAgent")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableTrunks")}</TableHead>
                <TableHead className="text-xs font-medium">{t("tableRuleId")}</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.sipDispatchRuleId} className="group">
                  <TableCell className="font-medium text-sm">
                    {rule.name || "—"}
                  </TableCell>
                  <TableCell>
                    <RuleTypeBadge type={getRuleType(rule)} />
                  </TableCell>
                  <TableCell className="text-sm">{getRuleTarget(rule)}</TableCell>
                  <TableCell className="text-sm">{getAgentName(rule)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(rule.trunkIds || []).length > 0
                        ? rule.trunkIds.map((id) => (
                            <span
                              key={id}
                              className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                            >
                              {trunkNameById(id)}
                            </span>
                          ))
                        : <span className="text-xs text-muted-foreground">{t("allTrunks")}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {rule.sipDispatchRuleId}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-muted"
                        onClick={() => openEditDialog(rule)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-red-50"
                        onClick={() => setDeleteConfirmId(rule.sipDispatchRuleId)}
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
              {stats.total} {stats.total === 1 ? "rule" : "rules"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Route className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("noRulesFound")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("createFirstRule")}</p>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 gap-0 sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50">
                {editingRule ? <Pencil className="h-3.5 w-3.5 text-amber-600" /> : <Route className="h-3.5 w-3.5 text-amber-600" />}
              </span>
              {editingRule ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              {editingRule ? t("editDescription") : t("createDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {/* Identity */}
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

            <div className="border-t" />
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{t("ruleType")}</div>
            {/* Rule type card selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["individual", "direct", "callee"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${formRuleType === type ? "border-foreground/30 bg-muted/40" : "hover:bg-muted/30"}`}
                  onClick={() => setFormRuleType(type)}
                >
                  <span className="text-xs font-medium block">
                    {type === "individual" ? t("ruleTypeIndividual") : type === "direct" ? t("ruleTypeDirect") : t("ruleTypeCallee")}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t" />
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Routing</div>
            {formRuleType === "direct" ? (
              <div>
                <label htmlFor="roomName" className="text-xs font-medium mb-1 block">{t("roomName")}</label>
                <Input
                  id="roomName"
                  className="h-8 font-mono text-xs"
                  placeholder="open-room"
                  value={formRoomName}
                  onChange={(e) => setFormRoomName(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="roomPrefix" className="text-xs font-medium mb-1 block">{t("roomPrefix")}</label>
                <Input
                  id="roomPrefix"
                  className="h-8 font-mono text-xs"
                  placeholder="call-"
                  value={formRoomPrefix}
                  onChange={(e) => setFormRoomPrefix(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="pin" className="text-xs font-medium mb-1 block">
                {t("pinLabel")} <span className="text-muted-foreground font-normal">{t("pinHint")}</span>
              </label>
              <Input
                id="pin"
                className="h-8 font-mono text-xs"
                placeholder="12345"
                value={formPin}
                onChange={(e) => setFormPin(e.target.value)}
              />
            </div>

            <div className="border-t" />
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Agent</div>
            <div>
              <label htmlFor="agentName" className="text-xs font-medium mb-1 block">
                {t("agentNameLabel")} <span className="text-muted-foreground font-normal">{t("agentNameHint")}</span>
              </label>
              <Input
                id="agentName"
                className="h-8 font-mono text-xs"
                placeholder="inbound-agent"
                value={formAgentName}
                onChange={(e) => setFormAgentName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="trunkIds" className="text-xs font-medium mb-1 block">
                {t("trunkIdsLabel")} <span className="text-muted-foreground font-normal">{t("trunkIdsHint")}</span>
              </label>
              <Input
                id="trunkIds"
                className="h-8 font-mono text-xs"
                placeholder="ST_xxx, ST_yyy"
                value={formTrunkIds}
                onChange={(e) => setFormTrunkIds(e.target.value)}
              />
            </div>

            <div className="border-t" />
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Options</div>
            <label htmlFor="hidePhoneNumber" className="flex items-center justify-between rounded-lg border px-3 py-3 cursor-pointer hover:bg-muted/30 transition-colors">
              <div>
                <span className="text-xs font-medium">{t("hidePhoneNumber")}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mask caller phone number from participants</p>
              </div>
              <input
                id="hidePhoneNumber"
                type="checkbox"
                checked={formHidePhoneNumber}
                onChange={(e) => setFormHidePhoneNumber(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 accent-foreground"
              />
            </label>

            <div className="border-t" />
            <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Metadata</div>
            <div>
              <label htmlFor="metadata" className="text-xs font-medium mb-1 block">
                {tc("metadataOptional")}
              </label>
              <Input
                id="metadata"
                className="h-8 font-mono text-xs"
                placeholder='{"source": "web"}'
                value={formMetadata}
                onChange={(e) => setFormMetadata(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="border-t px-5 py-3">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setDialogOpen(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {editingRule ? tc("update") : tc("create")}
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
