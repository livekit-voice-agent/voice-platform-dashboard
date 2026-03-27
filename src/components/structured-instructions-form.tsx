"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ExpandableTextarea } from "@/components/ui/expandable-textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChevronDown,
  Plus,
  X,
  User,
  Target,
  Ban,
  MessageCircle,
  MessagesSquare,
  GitBranch,
  ClipboardList,
  ArrowRightLeft,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InstructionFields } from "@/lib/instructions-serializer";

interface StructuredInstructionsFormProps {
  value: InstructionFields;
  onChange: (fields: InstructionFields) => void;
}

interface FieldConfig {
  key: keyof InstructionFields;
  labelKey: string;
  descriptionKey: string;
  placeholderKey: string;
  icon: React.ReactNode;
  rows?: number;
}

const SIMPLE_FIELDS: FieldConfig[] = [
  {
    key: "identity",
    labelKey: "identity",
    descriptionKey: "identityDescription",
    placeholderKey: "identityPlaceholder",
    icon: <User className="h-4 w-4" />,
    rows: 3,
  },
  {
    key: "objective",
    labelKey: "objective",
    descriptionKey: "objectiveDescription",
    placeholderKey: "objectivePlaceholder",
    icon: <Target className="h-4 w-4" />,
    rows: 2,
  },
  {
    key: "prohibitions",
    labelKey: "prohibitions",
    descriptionKey: "prohibitionsDescription",
    placeholderKey: "prohibitionsPlaceholder",
    icon: <Ban className="h-4 w-4" />,
    rows: 4,
  },
  {
    key: "toneOfVoice",
    labelKey: "toneOfVoice",
    descriptionKey: "toneOfVoiceDescription",
    placeholderKey: "toneOfVoicePlaceholder",
    icon: <MessageCircle className="h-4 w-4" />,
    rows: 3,
  },
  {
    key: "dialogExamples",
    labelKey: "dialogExamples",
    descriptionKey: "dialogExamplesDescription",
    placeholderKey: "dialogExamplesPlaceholder",
    icon: <MessagesSquare className="h-4 w-4" />,
    rows: 5,
  },
];

const ADVANCED_FIELDS: FieldConfig[] = [
  {
    key: "flow",
    labelKey: "flow",
    descriptionKey: "flowDescription",
    placeholderKey: "flowPlaceholder",
    icon: <GitBranch className="h-4 w-4" />,
    rows: 4,
  },
  {
    key: "transferRules",
    labelKey: "transferRules",
    descriptionKey: "transferRulesDescription",
    placeholderKey: "transferRulesPlaceholder",
    icon: <ArrowRightLeft className="h-4 w-4" />,
    rows: 3,
  },
  {
    key: "fallback",
    labelKey: "fallback",
    descriptionKey: "fallbackDescription",
    placeholderKey: "fallbackPlaceholder",
    icon: <HelpCircle className="h-4 w-4" />,
    rows: 3,
  },
];

function QualificationChecklist({
  items,
  onChange,
}: {
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const t = useTranslations("agent.instructions_form");
  const tc = useTranslations("common");

  const addItem = () => {
    const trimmed = newItem.trim();
    if (!trimmed) return;
    onChange([...items, trimmed]);
    setNewItem("");
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex h-4 w-4 items-center justify-center rounded border border-muted-foreground/30">
            <ClipboardList className="h-3 w-3 text-muted-foreground" />
          </div>
          <Input
            value={item}
            onChange={(e) => updateItem(index, e.target.value)}
            className="h-8 text-sm flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeItem(index)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={t("qualificationPlaceholder")}
          className="h-8 text-sm flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={addItem}
          disabled={!newItem.trim()}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {tc("add")}
        </Button>
      </div>
    </div>
  );
}

export function StructuredInstructionsForm({
  value,
  onChange,
}: StructuredInstructionsFormProps) {
  const t = useTranslations("agent.instructions_form");
  const tc = useTranslations("common");
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    return !!(
      value.flow ||
      value.qualification.length > 0 ||
      value.transferRules ||
      value.fallback
    );
  });

  const updateField = (key: keyof InstructionFields, fieldValue: string) => {
    onChange({ ...value, [key]: fieldValue });
  };

  return (
    <div className="space-y-4">
      {/* Simple Mode Fields */}
      <div className="space-y-4">
        {SIMPLE_FIELDS.map((field) => (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">{field.icon}</span>
              <Label className="text-sm font-medium">{t(field.labelKey)}</Label>
            </div>
            <p className="text-xs text-muted-foreground -mt-1">
              {t(field.descriptionKey)}
            </p>
            <ExpandableTextarea
              value={value[field.key] as string}
              onChange={(e) => updateField(field.key, e.target.value)}
              rows={field.rows ?? 3}
              className="text-sm resize-none"
              placeholder={t(field.placeholderKey)}
              expandLabel={tc("expand")}
              collapseLabel={tc("collapse")}
            />
          </div>
        ))}
      </div>

      {/* Advanced Mode - Collapsible */}
      <Card className="border-dashed">
        <CardHeader
          className="pb-3 cursor-pointer"
          onClick={() => setAdvancedOpen(!advancedOpen)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("advancedMode")}</CardTitle>
              <CardDescription>
                {t("advancedModeDescription")}
              </CardDescription>
            </div>
            <ChevronDown
              className={cn(
                "h-5 w-5 text-muted-foreground transition-transform",
                advancedOpen && "rotate-180"
              )}
            />
          </div>
        </CardHeader>
        {advancedOpen && (
          <CardContent className="space-y-4 pt-0">
            {ADVANCED_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{field.icon}</span>
                  <Label className="text-sm font-medium">{t(field.labelKey)}</Label>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  {t(field.descriptionKey)}
                </p>
                <ExpandableTextarea
                  value={value[field.key] as string}
                  onChange={(e) => updateField(field.key, e.target.value)}
                  rows={field.rows ?? 3}
                  className="text-sm resize-none"
                  placeholder={t(field.placeholderKey)}
                  expandLabel={tc("expand")}
                  collapseLabel={tc("collapse")}
                />
              </div>
            ))}

            {/* Qualification Checklist */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <Label className="text-sm font-medium">{t("qualification")}</Label>
              </div>
              <p className="text-xs text-muted-foreground -mt-1">
                {t("qualificationDescription")}
              </p>
              <QualificationChecklist
                items={value.qualification}
                onChange={(items) => onChange({ ...value, qualification: items })}
              />
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
