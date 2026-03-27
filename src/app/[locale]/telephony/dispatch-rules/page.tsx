"use client";

import { useCallback, useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Route, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

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

  // Form state
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
          {t("createRule")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            {t("cardTitle")}
          </CardTitle>
          <CardDescription>
            {t("cardDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Route className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t("noRulesFound")}</p>
              <p className="text-sm text-muted-foreground">
                {t("createFirstRule")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("tableName")}</TableHead>
                  <TableHead>{t("tableRuleType")}</TableHead>
                  <TableHead>{t("tableTarget")}</TableHead>
                  <TableHead>{t("tableAgent")}</TableHead>
                  <TableHead>{t("tableTrunks")}</TableHead>
                  <TableHead>{t("tableRuleId")}</TableHead>
                  <TableHead className="text-right">{t("tableActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.sipDispatchRuleId}>
                    <TableCell className="font-medium">
                      {rule.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getRuleType(rule)}</Badge>
                    </TableCell>
                    <TableCell>{getRuleTarget(rule)}</TableCell>
                    <TableCell>{getAgentName(rule)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(rule.trunkIds || []).length > 0
                          ? rule.trunkIds.map((id) => (
                              <Badge key={id} variant="secondary" className="text-xs">
                                {trunkNameById(id)}
                              </Badge>
                            ))
                          : t("allTrunks")}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {rule.sipDispatchRuleId}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteConfirmId(rule.sipDispatchRuleId)
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
              {editingRule ? t("editTitle") : t("createTitle")}
            </DialogTitle>
            <DialogDescription>
              {editingRule
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

                <div className="grid gap-2">
                  <Label>{t("ruleType")}</Label>
                  <Select
                    value={formRuleType}
                    onValueChange={(v) =>
                      setFormRuleType(v as "individual" | "direct" | "callee")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">
                        {t("ruleTypeIndividual")}
                      </SelectItem>
                      <SelectItem value="direct">
                        {t("ruleTypeDirect")}
                      </SelectItem>
                      <SelectItem value="callee">
                        {t("ruleTypeCallee")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formRuleType === "direct" ? (
                  <div className="grid gap-2">
                    <Label htmlFor="roomName">{t("roomName")}</Label>
                    <Input
                      id="roomName"
                      placeholder="open-room"
                      value={formRoomName}
                      onChange={(e) => setFormRoomName(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <Label htmlFor="roomPrefix">{t("roomPrefix")}</Label>
                    <Input
                      id="roomPrefix"
                      placeholder="call-"
                      value={formRoomPrefix}
                      onChange={(e) => setFormRoomPrefix(e.target.value)}
                    />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="pin">
                    {t("pinLabel")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {t("pinHint")}
                    </span>
                  </Label>
                  <Input
                    id="pin"
                    placeholder="12345"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="agentName">
                    {t("agentNameLabel")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {t("agentNameHint")}
                    </span>
                  </Label>
                  <Input
                    id="agentName"
                    placeholder="inbound-agent"
                    value={formAgentName}
                    onChange={(e) => setFormAgentName(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="trunkIds">
                    {t("trunkIdsLabel")}{" "}
                    <span className="text-xs text-muted-foreground">
                      {t("trunkIdsHint")}
                    </span>
                  </Label>
                  <Input
                    id="trunkIds"
                    placeholder="ST_xxx, ST_yyy"
                    value={formTrunkIds}
                    onChange={(e) => setFormTrunkIds(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hidePhoneNumber"
                    checked={formHidePhoneNumber}
                    onChange={(e) => setFormHidePhoneNumber(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="hidePhoneNumber">
                    {t("hidePhoneNumber")}
                  </Label>
                </div>

            <div className="grid gap-2">
              <Label htmlFor="metadata">
                {tc("metadataOptional")}
              </Label>
              <Input
                id="metadata"
                placeholder='{"source": "web"}'
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
