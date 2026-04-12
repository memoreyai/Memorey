"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { X, Send, Check, Sparkles, Plus } from "lucide-react";
import type { CategoryVault } from "@/types/memorey";
import {
  parseMessage,
  type ParsedNode,
  type ParseResult,
} from "../lib/chatParser";
import { toast } from "sonner";
import { useTrack } from "@/hooks/useTrack";

interface ChatGraphBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onNodesAdded: (
    rows: { id: string; vault_id: string; [key: string]: unknown }[]
  ) => void;
}

function GraphPreviewCanvas({
  nodes,
  vaults,
  pendingVaults,
}: {
  nodes: ParsedNode[];
  vaults: CategoryVault[];
  pendingVaults: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef(0);

  const allVaultNames = useMemo(() => {
    const existing = vaults.map((v) => ({
      id: v.id,
      name: v.name,
      color: v.color,
      isPending: false,
    }));
    const pending = pendingVaults.map((n) => ({
      id: `pending-${n}`,
      name: n,
      color: "#888780",
      isPending: true,
    }));
    return [...existing, ...pending];
  }, [vaults, pendingVaults]);

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const W = canvas.getBoundingClientRect().width;
      const H = canvas.getBoundingClientRect().height;
      if (W === 0 || H === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const isDark = document.documentElement.getAttribute("data-theme") !== "light";

      ctx.fillStyle = isDark ? "#0A0A0A" : "#FAFAFA";
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      for (let x = 0; x < W; x += 20) {
        for (let y = 0; y < H; y += 20) {
          ctx.beginPath();
          ctx.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const cx = W / 2;
      const cy = H * 0.42;

      const MNW = 110;
      const MNH = 40;
      const pulse = 0.5 + 0.5 * Math.sin(frameRef.current * 0.04);
      ctx.save();
      ctx.shadowColor = "#FF6600";
      ctx.shadowBlur = 8;
      ctx.fillStyle = isDark ? "#1A1208" : "#FFFFFF";
      ctx.beginPath();
      ctx.roundRect(cx - MNW / 2, cy - MNH / 2, MNW, MNH, 6);
      ctx.fill();
      ctx.strokeStyle =
        "#FF6600" +
        Math.round((0.5 + pulse * 0.4) * 255)
          .toString(16)
          .padStart(2, "0");
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      ctx.fillStyle = "#FF6600";
      ctx.fillRect(cx - MNW / 2, cy - MNH / 2 + 6, 3, MNH - 12);
      ctx.font = "600 10px Inter, system-ui";
      ctx.fillStyle = isDark ? "#F2F0EB" : "#0F0F0F";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("You", cx, cy);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";

      if (nodes.length === 0) {
        ctx.font = "400 11px Inter, system-ui";
        ctx.fillStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Nodes will appear here", cx, cy + 80);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        frameRef.current++;
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const byVault = new Map<string, ParsedNode[]>();
      for (const node of nodes) {
        const key = node.isNewVault
          ? `pending-${node.vaultName}`
          : (node.vaultId ?? node.vaultName);
        if (!byVault.has(key)) byVault.set(key, []);
        byVault.get(key)!.push(node);
      }

      const vaultEntries = [...byVault.entries()];
      const count = vaultEntries.length;
      const RADIUS = Math.min(W, H) * 0.3 + count * 10;

      const NW = 120;
      const NH = 34;
      const NR = 4;
      const PW = 88;
      const PH = 22;

      vaultEntries.forEach(([key, vaultNodes], vi) => {
        const vaultMeta = allVaultNames.find(
          (v) => v.id === key || v.name === vaultNodes[0]?.vaultName
        );
        const color = vaultMeta?.color ?? "#888780";
        const vName = vaultMeta?.name ?? vaultNodes[0]?.vaultName ?? "Vault";
        const isPending = vaultMeta?.isPending ?? false;

        const angle = (vi / count) * Math.PI * 2 - Math.PI / 2;
        const gx = cx + Math.cos(angle) * RADIUS;
        const gy = cy + Math.sin(angle) * RADIUS;

        const la = Math.atan2(gy - cy, gx - cx);
        const sx = cx + Math.cos(la) * (MNW / 2 + 4);
        const sy = cy + Math.sin(la) * (MNH / 2 + 4);
        const ex = gx - Math.cos(la) * (PW / 2 + 3);
        const ey = gy - Math.sin(la) * (PH / 2 + 3);

        ctx.save();
        ctx.strokeStyle = color + (isPending ? "44" : "77");
        ctx.lineWidth = 1;
        ctx.setLineDash(isPending ? [2, 3] : [4, 3]);
        ctx.lineDashOffset = -((frameRef.current * 0.25) % 7);
        ctx.shadowColor = color;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.save();
        ctx.fillStyle = color + "28";
        ctx.strokeStyle = color + (isPending ? "66" : "AA");
        ctx.lineWidth = 1;
        if (isPending) ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.roundRect(gx - PW / 2, gy - PH / 2, PW, PH, 11);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        if (isPending) {
          ctx.fillStyle = "#5DCAA5";
          ctx.font = "bold 7px Inter, system-ui";
          ctx.textAlign = "right";
          ctx.textBaseline = "top";
          ctx.fillText("new", gx + PW / 2 - 3, gy - PH / 2 + 3);
        }

        ctx.font = "600 9px Inter, system-ui";
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(vName.slice(0, 12), gx, gy);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.restore();

        vaultNodes.forEach((node, ni) => {
          const nx = gx - NW / 2;
          const ny = gy + PH / 2 + 10 + ni * (NH + 8);

          const progress = Math.min(1, (frameRef.current - vi * 6 - ni * 3) / 18);
          if (progress <= 0) return;

          const alpha = progress * (node.selected ? 1 : 0.35);
          ctx.save();
          ctx.globalAlpha = alpha;

          const isKanban = node.type === "kanban";

          ctx.fillStyle = isDark ? "#171410" : "#FFFFFF";
          ctx.strokeStyle = isKanban ? "#F5C542" + "88" : color + "44";
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.roundRect(nx, ny, NW, NH, NR);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isKanban ? "#F5C542" : color;
          ctx.fillRect(nx, ny + 4, 2.5, NH - 8);

          if (isKanban) {
            ctx.font = "8px serif";
            ctx.textBaseline = "middle";
            ctx.fillText("", nx + 6, ny + NH / 2);
            ctx.textBaseline = "alphabetic";
          }

          ctx.font = "500 8px Inter, system-ui";
          ctx.fillStyle = isDark ? "#F2F0EB" : "#0F0F0F";
          ctx.textBaseline = "middle";
          const textX = nx + (isKanban ? 20 : 8);
          const maxW = NW - (isKanban ? 24 : 12);
          let title = node.title;
          while (title.length > 3 && ctx.measureText(title).width > maxW) {
            title = title.slice(0, -1);
          }
          if (title !== node.title) title += "…";
          ctx.fillText(title, textX, ny + NH / 2);
          ctx.textBaseline = "alphabetic";
          ctx.restore();
        });
      });

      const kanbanNodes = nodes.filter((n) => n.type === "kanban");
      if (kanbanNodes.length > 0) {
        const BOARD_Y = H - 58;
        const BOARD_H = 50;
        const colW = (W - 24) / 3;
        const cols = [
          { status: "todo" as const, label: "To-do", color: "#888780" },
          { status: "doing" as const, label: "Doing", color: "#4FC1E9" },
          { status: "done" as const, label: "Done", color: "#5DCAA5" },
        ];

        ctx.save();
        ctx.fillStyle = isDark ? "rgba(0,0,0,0.35)" : "rgba(0,0,0,0.06)";
        ctx.beginPath();
        ctx.roundRect(8, BOARD_Y - 8, W - 16, BOARD_H + 16, 8);
        ctx.fill();

        ctx.font = "700 8px Inter, system-ui";
        ctx.textBaseline = "middle";

        cols.forEach((col, ci) => {
          const colX = 12 + ci * (colW + 4);
          const inCol = kanbanNodes.filter((n) => n.kanbanStatus === col.status);

          ctx.fillStyle = col.color + "33";
          ctx.beginPath();
          ctx.roundRect(colX, BOARD_Y - 2, colW, BOARD_H, 4);
          ctx.fill();

          ctx.fillStyle = col.color;
          ctx.textAlign = "center";
          ctx.fillText(col.label.toUpperCase(), colX + colW / 2, BOARD_Y + 10);

          ctx.font = "500 7px Inter, system-ui";
          ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)";
          ctx.fillText(
            inCol.length > 0
              ? inCol
                  .map((n) => n.title.slice(0, 12))
                  .join(", ")
                  .slice(0, 20)
              : "—",
            colX + colW / 2,
            BOARD_Y + 24
          );
          ctx.font = "700 8px Inter, system-ui";
        });
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      }

      frameRef.current++;
      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [nodes, allVaultNames]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
        }}
      >
        Preview
        {nodes.filter((n) => n.selected).length > 0 && (
          <span
            style={{
              padding: "1px 6px",
              background: "var(--orange-dim)",
              border: "1px solid var(--orange-border)",
              borderRadius: 100,
              color: "var(--orange)",
              fontSize: 9,
            }}
          >
            {nodes.filter((n) => n.selected).length} nodes
          </span>
        )}
        {nodes.some((n) => n.type === "kanban") && (
          <span
            style={{
              padding: "1px 6px",
              background: "rgba(93,202,165,0.15)",
              border: "1px solid rgba(93,202,165,0.3)",
              borderRadius: 100,
              color: "#5DCAA5",
              fontSize: 9,
            }}
          >
            + kanban
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        style={{ flex: 1, width: "100%", display: "block" }}
      />
    </div>
  );
}

export function ChatGraphBuilder({
  isOpen,
  onClose,
  onNodesAdded,
}: ChatGraphBuilderProps) {
  const vaults = useVaultStore((s) => s.vaults).filter((v) => v.isActive);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phase, setPhase] = useState<"input" | "review">("input");
  const [parsed, setParsed] = useState<ParsedNode[]>([]);
  const [pendingVaults, setPendingVaults] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerIndex, setPickerIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { track } = useTrack();

  useEffect(() => {
    if (!isOpen) {
      setMessage("");
      setParsed([]);
      setPendingVaults([]);
      setPhase("input");
      setShowPicker(false);
      setPickerQuery("");
    }
  }, [isOpen]);

  const liveParseResult = useMemo((): ParseResult => {
    if (!message.trim() || !message.includes("@")) {
      return { nodes: [], newVaults: [], usedAI: false };
    }
    return parseMessage(message, vaults);
  }, [message, vaults]);

  const liveParsed = liveParseResult.nodes;
  const liveNewVaults = liveParseResult.newVaults;

  const filteredVaults = vaults.filter(
    (v) =>
      !pickerQuery || v.name.toLowerCase().includes(pickerQuery.toLowerCase())
  );

  const kanbanOptions = [
    { id: "@todo", name: "To-Do", color: "#888780", isKanban: true as const },
    { id: "@doing", name: "Doing", color: "#4FC1E9", isKanban: true as const },
    { id: "@done", name: "Done", color: "#5DCAA5", isKanban: true as const },
  ].filter(
    (k) =>
      !pickerQuery || k.name.toLowerCase().includes(pickerQuery.toLowerCase())
  );

  type PickerOpt =
    | (CategoryVault & { isKanban: false })
    | (typeof kanbanOptions)[number];

  const allPickerOptions: PickerOpt[] = [
    ...filteredVaults.map((v) => ({ ...v, isKanban: false as const })),
    ...kanbanOptions,
  ];

  function handleTextChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setMessage(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atMatch = before.match(/@([^@\s]*)$/);
    if (atMatch) {
      setPickerQuery(atMatch[1]);
      setShowPicker(true);
      setPickerIndex(0);
    } else {
      setShowPicker(false);
      setPickerQuery("");
    }
  }

  function insertMention(option: { name: string }) {
    const cursor = textareaRef.current?.selectionStart ?? message.length;
    const before = message.slice(0, cursor);
    const after = message.slice(cursor);
    const atPos = before.lastIndexOf("@");
    const newMsg = before.slice(0, atPos) + `@${option.name} ` + after;
    setMessage(newMsg);
    setShowPicker(false);
    setPickerQuery("");
    setTimeout(() => textareaRef.current?.focus(), 10);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showPicker) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setPickerIndex((i) =>
          Math.min(i + 1, allPickerOptions.length - 1)
        );
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setPickerIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        const opt = allPickerOptions[pickerIndex];
        if (opt) insertMention(opt);
        return;
      }
      if (e.key === "Escape") {
        setShowPicker(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!message.trim() || loading) return;
    track("capture_chat_sent", {});
    setLoading(true);

    try {
      const result: ParseResult = parseMessage(message, vaults);

      if (result.nodes.length > 0) {
        setParsed(result.nodes);
        setPendingVaults(result.newVaults);
        setPhase("review");
        setLoading(false);
        return;
      }

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/graph-builder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          message: message.trim(),
          vaults: vaults.map((v) => ({ id: v.id, name: v.name })),
          canvasId: activeCanvasId,
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `API error ${res.status}`);
      }

      const data = (await res.json()) as {
        nodes?: {
          title: string;
          value: string;
          vault_id: string;
          vault_name: string;
          confidence: number;
        }[];
      };

      const aiNodes: ParsedNode[] = (data.nodes ?? []).map((n) => ({
        type: "memory" as const,
        title: n.title,
        value: n.value,
        vaultId: n.vault_id,
        vaultName: n.vault_name,
        isNewVault: false,
        selected: true,
        confidence: n.confidence ?? 0.85,
      }));

      if (aiNodes.length === 0) {
        toast.message(
          "Couldn't extract memories. Try using @VaultName to be explicit."
        );
        setLoading(false);
        return;
      }

      setParsed(aiNodes);
      setPendingVaults([]);
      setPhase("review");
    } catch (err) {
      console.error("[ChatGraphBuilder] error:", err);
      toast.error("Could not process message. Try using @VaultName syntax.");
    }
    setLoading(false);
  }, [message, loading, vaults, activeCanvasId, track]);

  const memoryValue = (node: ParsedNode) => {
    const v = (node.value || "").trim();
    if (v) return v.slice(0, 600);
    return (node.title || "Note").trim().slice(0, 600);
  };

  const handleApprove = useCallback(async () => {
    const selected = parsed.filter((n) => n.selected);
    if (selected.length === 0) {
      toast.message("Select at least one item");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        setSaving(false);
        return;
      }

      const createdVaultMap = new Map<string, string>();
      const addVaultToCanvas = useVaultStore.getState().addVaultToCanvas;
      const addCustomVault = useVaultStore.getState().addCustomVault;

      for (const vaultName of pendingVaults) {
        const existingVaults = useVaultStore.getState().vaults;
        const alreadyExists = existingVaults.find(
          (v) => v.name.toLowerCase() === vaultName.toLowerCase()
        );
        if (alreadyExists) {
          createdVaultMap.set(vaultName, alreadyExists.id);
          continue;
        }

        try {
          const v = await addCustomVault(
            session.user.id,
            vaultName.trim(),
            "#888780"
          );
          createdVaultMap.set(vaultName, v.id);
          if (activeCanvasId) {
            await addVaultToCanvas(v.id, activeCanvasId, v.displayOrder);
          }
        } catch (e) {
          console.error("[ChatGraphBuilder] vault create:", e);
          toast.error(`Could not create vault "${vaultName}"`);
          setSaving(false);
          return;
        }
      }

      const saved: { id: string; vault_id: string; [key: string]: unknown }[] =
        [];

      for (const node of selected) {
        const resolvedVaultId = node.isNewVault
          ? (createdVaultMap.get(node.vaultName) ?? vaults[0]?.id)
          : (node.vaultId ?? vaults[0]?.id);

        if (!resolvedVaultId) continue;

        if (node.type === "kanban") {
          const valueStr = memoryValue(node);
          const { data, error } = await supabase
            .from("memory_nodes")
            .insert({
              user_id: session.user.id,
              vault_id: resolvedVaultId,
              title: node.title.slice(0, 100),
              value: valueStr,
              confidence: 1.0,
              source: "chat",
              is_active: true,
              kanban_status: node.kanbanStatus ?? "todo",
              kanban_order: Date.now(),
              canvas_id: activeCanvasId ?? null,
            })
            .select(
              "id, user_id, vault_id, title, value, confidence, source, is_active, created_at, updated_at, canvas_id, kanban_status"
            )
            .single();

          if (!error && data) saved.push(data);
        } else {
          const res = await fetch("/api/memory/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              vaultId: resolvedVaultId,
              title: node.title.slice(0, 100),
              value: memoryValue(node),
              confidence: node.confidence,
              source: "chat",
              userId: session.user.id,
              canvasId: activeCanvasId,
            }),
          });

          if (res.ok) {
            const { node: savedNode } = (await res.json()) as {
              node?: { id: string; vault_id: string; [key: string]: unknown };
            };
            if (savedNode) saved.push(savedNode);
          }
        }
      }

      if (saved.length > 0) {
        onNodesAdded(saved);
        const memCount = selected.filter((n) => n.type === "memory").length;
        const kanbanCount = selected.filter((n) => n.type === "kanban").length;
        const parts: string[] = [];
        if (memCount > 0) {
          parts.push(`${memCount} memor${memCount === 1 ? "y" : "ies"}`);
        }
        if (kanbanCount > 0) {
          parts.push(
            `${kanbanCount} kanban card${kanbanCount === 1 ? "" : "s"}`
          );
        }
        toast.success(`Added ${parts.join(" + ")} to your workspace`);
        onClose();
      } else {
        toast.error("Nothing was saved — check console for errors");
      }
    } catch (err) {
      console.error("[ChatGraphBuilder] save error:", err);
      toast.error("Could not save items");
    }
    setSaving(false);
  }, [parsed, pendingVaults, vaults, activeCanvasId, onNodesAdded, onClose]);

  if (!isOpen) return null;

  const previewNodes = phase === "review" ? parsed : liveParsed;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 900,
          maxWidth: "95vw",
          maxHeight: "90vh",
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 210,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 18px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <Sparkles size={15} style={{ color: "var(--orange)" }} />
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}
            >
              Chat to graph
            </div>
            <div
              style={{ fontSize: 10, color: "var(--muted)", marginTop: 1 }}
            >
              Use{" "}
              <kbd
                style={{
                  padding: "0 4px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  fontSize: 9,
                }}
              >
                @VaultName
              </kbd>{" "}
              to assign. Supports{" "}
              <kbd
                style={{
                  padding: "0 4px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  fontSize: 9,
                }}
              >
                @To-Do
              </kbd>{" "}
              /{" "}
              <kbd
                style={{
                  padding: "0 4px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  fontSize: 9,
                }}
              >
                @Doing
              </kbd>{" "}
              /{" "}
              <kbd
                style={{
                  padding: "0 4px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 3,
                  fontSize: 9,
                }}
              >
                @Done
              </kbd>{" "}
              for Kanban. New vaults created automatically.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={13} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <div
            style={{
              width: 400,
              borderRight: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div
              style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}
            >
              {phase === "input" && (
                <>
                  <textarea
                    ref={textareaRef}
                    value={message}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    placeholder={`Type your memories and use @VaultName to assign.\n\nExample:\n@Work On Yapaar, a B2B eCommerce\n@Finance Need to raise funds\n@To-Do Prepare pitch deck\n@Research Research on investors`}
                    rows={8}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      padding: "10px 12px",
                      color: "var(--text)",
                      fontSize: 12,
                      lineHeight: 1.7,
                      resize: "vertical",
                      outline: "none",
                      fontFamily: "var(--font-sans)",
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = "var(--orange)";
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = "var(--border)";
                    }}
                  />

                  {showPicker && allPickerOptions.length > 0 && (
                    <div
                      style={{
                        marginTop: 4,
                        background: "var(--bg3)",
                        border: "1px solid var(--border2)",
                        borderRadius: 8,
                        boxShadow: "var(--shadow-lg)",
                        overflow: "hidden",
                        maxHeight: 220,
                        overflowY: "auto",
                      }}
                    >
                      <div
                        style={{
                          padding: "5px 10px 4px",
                          fontSize: 9,
                          color: "var(--muted)",
                          borderBottom: "1px solid var(--border)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        Assign vault
                      </div>
                      {allPickerOptions.map((opt, i) => (
                        <button
                          key={opt.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            insertMention(opt);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            width: "100%",
                            padding: "7px 12px",
                            background:
                              i === pickerIndex ? "var(--bg4)" : "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text)",
                            fontSize: 12,
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: opt.color,
                              flexShrink: 0,
                            }}
                          />
                          {opt.name}
                          {"isKanban" in opt && opt.isKanban && (
                            <span
                              style={{
                                fontSize: 9,
                                color: "#5DCAA5",
                                marginLeft: "auto",
                                background: "rgba(93,202,165,0.12)",
                                padding: "0 5px",
                                borderRadius: 3,
                              }}
                            >
                              kanban
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {liveParsed.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          fontSize: 9,
                          color: "var(--muted)",
                          textTransform: "uppercase",
                          letterSpacing: "0.07em",
                          marginBottom: 5,
                        }}
                      >
                        Will create ({liveParsed.length})
                      </div>
                      <div
                        style={{ display: "flex", gap: 4, flexWrap: "wrap" }}
                      >
                        {liveParsed.map((n, i) => {
                          const v = vaults.find((x) => x.id === n.vaultId);
                          const color = v?.color ?? "#888780";
                          return (
                            <span
                              key={i}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "2px 7px",
                                background: color + "18",
                                border: `1px solid ${color}33`,
                                borderRadius: 100,
                                fontSize: 10,
                                color,
                              }}
                            >
                              {n.type === "kanban" && (
                                <span style={{ fontSize: 9 }}></span>
                              )}
                              {n.isNewVault && <Plus size={8} />}
                              {n.vaultName}: {n.title.slice(0, 25)}
                              {n.title.length > 25 ? "…" : ""}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {liveNewVaults.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: "7px 10px",
                        background: "rgba(93,202,165,0.08)",
                        border: "1px solid rgba(93,202,165,0.2)",
                        borderRadius: 6,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          color: "#5DCAA5",
                          fontWeight: 600,
                          marginBottom: 3,
                        }}
                      >
                        New vaults to create:
                      </div>
                      {liveNewVaults.map((n) => (
                        <div
                          key={n}
                          style={{ fontSize: 10, color: "var(--text2)" }}
                        >
                          • {n}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {phase === "review" && (
                <>
                  {pendingVaults.length > 0 && (
                    <div
                      style={{
                        marginBottom: 12,
                        padding: "8px 10px",
                        background: "rgba(93,202,165,0.08)",
                        border: "1px solid rgba(93,202,165,0.25)",
                        borderRadius: 8,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "#5DCAA5",
                          marginBottom: 4,
                        }}
                      >
                        New vaults to create
                      </div>
                      {pendingVaults.map((n) => (
                        <div
                          key={n}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11,
                            color: "var(--text2)",
                          }}
                        >
                          <Plus size={10} style={{ color: "#5DCAA5" }} />
                          {n}
                        </div>
                      ))}
                    </div>
                  )}

                  {parsed.map((node, i) => {
                    const v = vaults.find((x) => x.id === node.vaultId);
                    const color = v?.color ?? "#888780";
                    const isKanban = node.type === "kanban";
                    return (
                      <div
                        key={i}
                        onClick={() =>
                          setParsed((prev) =>
                            prev.map((n, j) =>
                              j === i ? { ...n, selected: !n.selected } : n
                            )
                          )
                        }
                        style={{
                          display: "flex",
                          gap: 9,
                          alignItems: "flex-start",
                          padding: "9px 10px",
                          marginBottom: 5,
                          background: node.selected
                            ? isKanban
                              ? "rgba(245,197,66,0.08)"
                              : color + "10"
                            : "var(--bg2)",
                          border: `1px solid ${
                            node.selected
                              ? isKanban
                                ? "#F5C54266"
                                : color + "44"
                              : "var(--border)"
                          }`,
                          borderRadius: "var(--r-md)",
                          cursor: "pointer",
                          transition: "all 0.1s",
                        }}
                      >
                        <div
                          style={{
                            width: 15,
                            height: 15,
                            borderRadius: 3,
                            flexShrink: 0,
                            marginTop: 1,
                            background: node.selected
                              ? isKanban
                                ? "#F5C542"
                                : color
                              : "var(--bg3)",
                            border: `1.5px solid ${
                              node.selected
                                ? isKanban
                                  ? "#F5C542"
                                  : color
                                : "var(--border2)"
                            }`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {node.selected && (
                            <Check size={9} color="#fff" strokeWidth={3} />
                          )}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              flexWrap: "wrap",
                              marginBottom: 4,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "1px 6px",
                                background: color + "22",
                                border: `1px solid ${color}33`,
                                borderRadius: 100,
                                fontSize: 9,
                                fontWeight: 600,
                                color,
                              }}
                            >
                              {node.isNewVault && <Plus size={7} />}
                              {node.vaultName}
                            </span>
                            {isKanban && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  padding: "1px 6px",
                                  background: "rgba(245,197,66,0.15)",
                                  border: "1px solid rgba(245,197,66,0.35)",
                                  borderRadius: 100,
                                  fontSize: 9,
                                  fontWeight: 600,
                                  color: "#F5C542",
                                }}
                              >
                                
                                {node.kanbanStatus?.toUpperCase() ?? "TO-DO"}
                              </span>
                            )}
                            {node.confidence < 1 && (
                              <span
                                style={{ fontSize: 9, color: "var(--muted)" }}
                              >
                                {Math.round(node.confidence * 100)}% AI
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text)",
                              marginBottom: 2,
                            }}
                          >
                            {node.title}
                          </div>
                          {node.value && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--text2)",
                                lineHeight: 1.4,
                              }}
                            >
                              {node.value}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setParsed((p) => p.map((n) => ({ ...n, selected: true })))
                      }
                      style={{
                        fontSize: 11,
                        color: "var(--orange)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setParsed((p) =>
                          p.map((n) => ({ ...n, selected: false }))
                        )
                      }
                      style={{
                        fontSize: 11,
                        color: "var(--muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Deselect all
                    </button>
                  </div>
                </>
              )}
            </div>

            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 7,
                flexShrink: 0,
              }}
            >
              {phase === "input" ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      padding: "7px 12px",
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--text2)",
                    }}
                  >
                    Cancel
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!message.trim() || loading}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 16px",
                      background:
                        message.trim() && !loading
                          ? "var(--orange)"
                          : "var(--bg4)",
                      border: "none",
                      borderRadius: "var(--r-md)",
                      cursor:
                        message.trim() && !loading ? "pointer" : "not-allowed",
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        message.trim() && !loading ? "#fff" : "var(--muted)",
                    }}
                  >
                    {loading ? (
                      <>
                        <div
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: "50%",
                            border: "2px solid rgba(255,255,255,0.3)",
                            borderTopColor: "#fff",
                            animation: "spin 0.6s linear infinite",
                          }}
                        />{" "}
                        Processing…
                      </>
                    ) : (
                      <>
                        <Send size={11} /> Create
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("input");
                      setParsed([]);
                      setPendingVaults([]);
                    }}
                    style={{
                      padding: "7px 12px",
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      fontSize: 12,
                      color: "var(--text2)",
                    }}
                  >
                    ← Back
                  </button>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>
                      {parsed.filter((n) => n.selected).length}/{parsed.length}{" "}
                      selected
                      {parsed.some(
                        (n) => n.type === "kanban" && n.selected
                      ) && (
                        <span style={{ color: "#5DCAA5", marginLeft: 5 }}>
                          +{" "}
                          {
                            parsed.filter(
                              (n) => n.type === "kanban" && n.selected
                            ).length
                          }{" "}
                          kanban
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleApprove()}
                    disabled={
                      saving || parsed.filter((n) => n.selected).length === 0
                    }
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 16px",
                      background:
                        parsed.filter((n) => n.selected).length > 0 && !saving
                          ? "var(--orange)"
                          : "var(--bg4)",
                      border: "none",
                      borderRadius: "var(--r-md)",
                      cursor:
                        parsed.filter((n) => n.selected).length > 0 && !saving
                          ? "pointer"
                          : "not-allowed",
                      fontSize: 12,
                      fontWeight: 600,
                      color:
                        parsed.filter((n) => n.selected).length > 0 && !saving
                          ? "#fff"
                          : "var(--muted)",
                    }}
                  >
                    {saving ? (
                      <>
                        <div
                          style={{
                            width: 11,
                            height: 11,
                            borderRadius: "50%",
                            border: "2px solid rgba(255,255,255,0.3)",
                            borderTopColor: "#fff",
                            animation: "spin 0.6s linear infinite",
                          }}
                        />{" "}
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check size={11} /> Add to workspace
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              background: "var(--bg)",
              overflow: "hidden",
              minWidth: 0,
            }}
          >
            <GraphPreviewCanvas
              nodes={previewNodes}
              vaults={vaults}
              pendingVaults={phase === "review" ? pendingVaults : []}
            />
          </div>
        </div>
      </div>
    </>
  );
}
