export function getStickyColumnClass(column: "completedAt" | "action") {
  if (column === "action") {
    return "sticky right-0 bg-background";
  }

  return "sticky right-[172px] bg-background";
}

export function getScrollableCellClass() {
  return "max-w-[260px] overflow-x-auto whitespace-nowrap";
}
