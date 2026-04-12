import React from "react";
import { useMemoreyState } from "../store/memoreyStore";

const DEFAULT_VAULT_COLORS: Record<string, string> = {
  identity: "#8B5CF6",
  personal: "#8B5CF6",
  work: "#3B82F6",
  preferences: "#EC4899",
  knowledge: "#10B981",
  study: "#10B981",
  relationships: "#F59E0B",
  projects: "#6366F1",
  goals: "#6366F1",
  history: "#78716C",
  context: "#06B6D4",
  health: "#22C55E",
  finance: "#F59E0B",
  creative: "#EC4899",
};

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function getVaultColor(name: string): string {
  const lower = name.toLowerCase();
  return DEFAULT_VAULT_COLORS[lower] ?? hashColor(lower);
}

interface VaultBadgeProps {
  vault: string;
  onClick?: () => void;
}

export function VaultBadge({ vault, onClick }: VaultBadgeProps) {
  const { vaults } = useMemoreyState();
  const vaultDef = vaults.find((v) => v.id === vault);
  const displayName = vaultDef?.name ?? vault;
  const color = vaultDef?.color ?? getVaultColor(displayName);
  const bg = color + "1A";

  const style: React.CSSProperties = {
    background: bg,
    color,
    cursor: onClick ? "pointer" : undefined,
  };

  return (
    <span className="memorey-vault-badge" style={style} onClick={onClick} title={displayName}>
      {displayName}
    </span>
  );
}
