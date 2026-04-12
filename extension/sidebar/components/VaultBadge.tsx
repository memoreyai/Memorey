import React from "react";

const DEFAULT_VAULT_COLORS: Record<string, string> = {
  identity: "#8B5CF6",
  work: "#3B82F6",
  preferences: "#EC4899",
  knowledge: "#10B981",
  relationships: "#F59E0B",
  projects: "#6366F1",
  history: "#78716C",
  context: "#06B6D4",
};

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function getVaultColor(vault: string): string {
  return DEFAULT_VAULT_COLORS[vault] ?? hashColor(vault);
}

interface VaultBadgeProps {
  vault: string;
  onClick?: () => void;
}

export function VaultBadge({ vault, onClick }: VaultBadgeProps) {
  const color = getVaultColor(vault);
  const bg = color + "1A"; // ~10% opacity hex
  const style: React.CSSProperties = {
    background: bg,
    color,
    cursor: onClick ? "pointer" : undefined,
  };

  return (
    <span className="memorey-vault-badge" style={style} onClick={onClick} title={vault}>
      {vault}
    </span>
  );
}
