"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dispatchRuleApi,
  agentWorkerApi,
  type DispatchRuleInfo,
  type CreateDispatchRuleRequest,
} from "@/lib/api";
import { toast } from "sonner";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

function getAgentName(rule: DispatchRuleInfo): string {
  const agents = rule.roomConfig?.agents;
  return agents && agents.length > 0 ? agents[0].agentName : "";
}

function getRuleType(rule: DispatchRuleInfo): "direct" | "individual" | "callee" {
  if (rule.rule?.dispatchRuleDirect) return "direct";
  if (rule.rule?.dispatchRuleCallee) return "callee";
  return "individual";
}

function ruleToUpdatePayload(rule: DispatchRuleInfo, agentName: string): CreateDispatchRuleRequest {
  const type = getRuleType(rule);
  const base: CreateDispatchRuleRequest = {
    name: rule.name,
    ruleType: type,
    trunkIds: rule.trunkIds,
    metadata: rule.metadata || undefined,
    hidePhoneNumber: rule.hidePhoneNumber,
    agentName,
  };

  if (type === "direct") {
    base.roomName = rule.rule?.dispatchRuleDirect?.roomName;
    const pin = rule.rule?.dispatchRuleDirect?.pin;
    if (pin) base.pin = pin;
  } else if (type === "callee") {
    base.roomPrefix = rule.rule?.dispatchRuleCallee?.roomPrefix;
    const pin = rule.rule?.dispatchRuleCallee?.pin;
    if (pin) base.pin = pin;
  } else {
    base.roomPrefix = rule.rule?.dispatchRuleIndividual?.roomPrefix || "call-";
    const pin = rule.rule?.dispatchRuleIndividual?.pin;
    if (pin) base.pin = pin;
  }

  return base;
}

interface SwitchDispatchRulesDialogProps {
  fromAgent: string;
  open: boolean;
  onClose: () => void;
}

export function SwitchDispatchRulesDialog({
  fromAgent,
  open,
  onClose,
}: SwitchDispatchRulesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [targetAgent, setTargetAgent] = useState("");
  const [availableAgents, setAvailableAgents] = useState<string[]>([]);
  const [matchingRules, setMatchingRules] = useState<DispatchRuleInfo[]>([]);

  const loadData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [rules, agents] = await Promise.all([
        dispatchRuleApi.list(),
        agentWorkerApi.available(),
      ]);
      const filtered = rules.filter((r) => getAgentName(r) === fromAgent);
      setMatchingRules(filtered);
      setAvailableAgents(agents.filter((a) => a !== fromAgent));
      setTargetAgent("");
    } catch {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [open, fromAgent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSwitch = async () => {
    if (!targetAgent || matchingRules.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        matchingRules.map((rule) =>
          dispatchRuleApi.update(
            rule.sipDispatchRuleId,
            ruleToUpdatePayload(rule, targetAgent)
          )
        )
      );
      toast.success(
        `${matchingRules.length} regra(s) redirecionada(s) para ${targetAgent}`
      );
      onClose();
    } catch {
      toast.error("Erro ao atualizar dispatch rules");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            Trocar Agent nas Dispatch Rules
          </DialogTitle>
          <DialogDescription>
            {loading ? (
              "Carregando..."
            ) : matchingRules.length === 0 ? (
              `Nenhuma dispatch rule aponta para "${fromAgent}".`
            ) : (
              <>
                <strong>{matchingRules.length}</strong> dispatch rule(s) apontam
                para <strong>{fromAgent}</strong>. Escolha o agent de destino:
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {!loading && matchingRules.length > 0 && (
          <div className="space-y-3 py-2">
            <Label>Agent de destino</Label>
            <Select value={targetAgent} onValueChange={setTargetAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agent..." />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          {!loading && matchingRules.length > 0 && (
            <Button
              onClick={handleSwitch}
              disabled={!targetAgent || saving}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redirecionar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
