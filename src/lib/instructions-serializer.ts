export interface InstructionFields {
  identity: string;
  objective: string;
  prohibitions: string;
  toneOfVoice: string;
  dialogExamples: string;
  flow: string;
  qualification: string[];
  transferRules: string;
  fallback: string;
}

export const EMPTY_FIELDS: InstructionFields = {
  identity: "",
  objective: "",
  prohibitions: "",
  toneOfVoice: "",
  dialogExamples: "",
  flow: "",
  qualification: [],
  transferRules: "",
  fallback: "",
};

const SECTION_HEADERS: Record<keyof InstructionFields, string> = {
  identity: "## Identidade",
  objective: "## Objetivo",
  prohibitions: "## Proibições",
  toneOfVoice: "## Tom de Voz",
  dialogExamples: "## Exemplos de Diálogo",
  flow: "## Fluxo",
  qualification: "## Qualificação",
  transferRules: "## Regras de Transferência",
  fallback: "## Fallback",
};

const SECTION_ORDER: (keyof InstructionFields)[] = [
  "identity",
  "objective",
  "prohibitions",
  "toneOfVoice",
  "dialogExamples",
  "flow",
  "qualification",
  "transferRules",
  "fallback",
];

/**
 * Compose structured fields into a single instructions string.
 * Empty sections are omitted.
 */
export function composeInstructions(fields: InstructionFields): string {
  const parts: string[] = [];

  for (const key of SECTION_ORDER) {
    const header = SECTION_HEADERS[key];

    if (key === "qualification") {
      const items = fields.qualification.filter((item) => item.trim() !== "");
      if (items.length === 0) continue;
      const checklist = items.map((item) => `- [ ] ${item}`).join("\n");
      parts.push(`${header}\n${checklist}`);
    } else {
      const value = (fields[key] as string).trim();
      if (!value) continue;
      parts.push(`${header}\n${value}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Parse a raw instructions string into structured fields.
 * If no section markers are found, all text goes into the identity field.
 */
export function parseInstructions(raw: string): InstructionFields {
  const fields: InstructionFields = { ...EMPTY_FIELDS, qualification: [] };

  if (!raw || !raw.trim()) return fields;

  // Check if the text has any section markers
  const hasMarkers = SECTION_ORDER.some((key) =>
    raw.includes(SECTION_HEADERS[key])
  );

  if (!hasMarkers) {
    // Legacy: put everything in identity
    fields.identity = raw.trim();
    return fields;
  }

  // Build a regex that splits on any of the section headers
  const headerValues = Object.values(SECTION_HEADERS).map((h) =>
    h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const splitRegex = new RegExp(`(${headerValues.join("|")})`, "g");

  const parts = raw.split(splitRegex).filter((part) => part.trim() !== "");

  // Map header strings back to field keys
  const headerToKey = new Map<string, keyof InstructionFields>();
  for (const key of SECTION_ORDER) {
    headerToKey.set(SECTION_HEADERS[key], key);
  }

  let currentKey: keyof InstructionFields | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    const key = headerToKey.get(trimmed);

    if (key) {
      currentKey = key;
    } else if (currentKey) {
      if (currentKey === "qualification") {
        // Parse checklist items: "- [ ] item" or "- [x] item" or "- item"
        const items = trimmed
          .split("\n")
          .map((line) => line.replace(/^-\s*(\[[ x]?\])?\s*/, "").trim())
          .filter((item) => item !== "");
        fields.qualification = items;
      } else {
        fields[currentKey] = trimmed;
      }
      currentKey = null;
    }
  }

  return fields;
}
