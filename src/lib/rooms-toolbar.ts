export type HistoryColumnId =
  | "roomName"
  | "status"
  | "agent"
  | "caller"
  | "ticket"
  | "duration"
  | "channel"
  | "createdAt";

export const HISTORY_COLUMN_OPTIONS: Array<{ id: HistoryColumnId; label: string }> = [
  { id: "roomName", label: "Sala" },
  { id: "status", label: "Status" },
  { id: "agent", label: "Agente" },
  { id: "caller", label: "Telefone" },
  { id: "ticket", label: "Ticket" },
  { id: "duration", label: "Duração" },
  { id: "channel", label: "Canal" },
  { id: "createdAt", label: "Criado em" },
];

export function getDefaultHistoryColumns(): HistoryColumnId[] {
  return HISTORY_COLUMN_OPTIONS.map((column) => column.id);
}

export function getAdvancedFilterState(ticketField: string, ticketValue: string) {
  const count = [ticketField, ticketValue].filter(Boolean).length;

  return {
    active: count > 0,
    label: count > 0 ? `Avançado (${count})` : "Avançado",
  };
}
