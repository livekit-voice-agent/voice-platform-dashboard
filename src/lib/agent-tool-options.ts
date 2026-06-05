type AgentToolLike = {
  name: string;
  enabled: boolean;
  sort_order: number;
};

type ToolOption = {
  value: string;
  label: string;
};

export function getExecutableToolOptions(
  agentTools: AgentToolLike[],
  currentToolName?: string
): ToolOption[] {
  const options = agentTools
    .filter((tool) => tool.enabled)
    .sort((left, right) => {
      if (left.sort_order !== right.sort_order) {
        return left.sort_order - right.sort_order;
      }

      return left.name.localeCompare(right.name);
    })
    .map((tool) => ({
      value: tool.name,
      label: tool.name,
    }));

  if (currentToolName && !options.some((option) => option.value === currentToolName)) {
    options.push({
      value: currentToolName,
      label: `${currentToolName} (desabilitada)`,
    });
  }

  return options;
}
