"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EdgeStyle as MemoreyEdgeStyle } from "@/types/memorey";
import type { EdgeStyle } from "../types/canvas.types";

export function useEdgeStyle(
  userId: string | null,
  activeCanvasId: string | null
): {
  edgeStyle: EdgeStyle;
  edgeStyleRef: React.MutableRefObject<EdgeStyle>;
  handleEdgeStyleChange: (style: EdgeStyle) => Promise<void>;
  edgeColor: string | null;
  edgeColorRef: React.MutableRefObject<string | null>;
  handleEdgeColorChange: (color: string | null) => Promise<void>;
  masterLineStyle: string;
  masterLineStyleRef: React.MutableRefObject<string>;
  handleMasterLineStyleChange: (style: string) => Promise<void>;
  masterLineColor: string | null;
  masterLineColorRef: React.MutableRefObject<string | null>;
  handleMasterLineColorChange: (color: string | null) => Promise<void>;
} {
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>("orthogonal-dashed");
  const edgeStyleRef = useRef<EdgeStyle>("orthogonal-dashed");
  const [edgeColor, setEdgeColor] = useState<string | null>(null);
  const edgeColorRef = useRef<string | null>(null);

  const [masterLineStyle, setMasterLineStyle] = useState<string>("curved-dashed");
  const [masterLineColor, setMasterLineColor] = useState<string | null>(null);
  const masterLineStyleRef = useRef<string>("curved-dashed");
  const masterLineColorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    void supabase
      .from("profiles")
      .select("graph_edge_style, graph_edge_color")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        const style =
          (data?.graph_edge_style as MemoreyEdgeStyle) ?? "orthogonal-dashed";
        setEdgeStyle(style as EdgeStyle);
        edgeStyleRef.current = style as EdgeStyle;
        const c = data?.graph_edge_color ?? null;
        setEdgeColor(c);
        edgeColorRef.current = c;
      });
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const load = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("master_line_style, master_line_color")
        .eq("id", userId)
        .single();
      const profStyle = profile?.master_line_style ?? "curved-dashed";
      const profColor = profile?.master_line_color ?? null;

      if (!activeCanvasId) {
        setMasterLineStyle(profStyle);
        setMasterLineColor(profColor);
        masterLineStyleRef.current = profStyle;
        masterLineColorRef.current = profColor;
        return;
      }

      const { data: canvas } = await supabase
        .from("canvases")
        .select("master_line_style, master_line_color")
        .eq("id", activeCanvasId)
        .single();

      const ms = canvas?.master_line_style ?? profStyle;
      const mc = canvas?.master_line_color ?? profColor;
      setMasterLineStyle(ms);
      setMasterLineColor(mc);
      masterLineStyleRef.current = ms;
      masterLineColorRef.current = mc;
    };
    void load();
  }, [userId, activeCanvasId]);

  const handleEdgeStyleChange = useCallback(
    async (style: EdgeStyle) => {
      setEdgeStyle(style);
      edgeStyleRef.current = style;
      if (!userId) return;
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ graph_edge_style: style })
        .eq("id", userId);
    },
    [userId]
  );

  const handleEdgeColorChange = useCallback(
    async (color: string | null) => {
      setEdgeColor(color);
      edgeColorRef.current = color;
      if (!userId) return;
      const supabase = createClient();
      await supabase
        .from("profiles")
        .update({ graph_edge_color: color })
        .eq("id", userId);
    },
    [userId]
  );

  const handleMasterLineStyleChange = useCallback(
    async (style: string) => {
      setMasterLineStyle(style);
      masterLineStyleRef.current = style;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ master_line_style: style })
        .eq("id", user.id);
      const { useCanvasStore } = await import("@/store/canvasStore");
      const canvasId = useCanvasStore.getState().activeCanvasId;
      if (canvasId) {
        await supabase
          .from("canvases")
          .update({ master_line_style: style })
          .eq("id", canvasId);
      }
    },
    []
  );

  const handleMasterLineColorChange = useCallback(
    async (color: string | null) => {
      setMasterLineColor(color);
      masterLineColorRef.current = color;
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("profiles")
        .update({ master_line_color: color })
        .eq("id", user.id);
      const { useCanvasStore } = await import("@/store/canvasStore");
      const canvasId = useCanvasStore.getState().activeCanvasId;
      if (canvasId) {
        await supabase
          .from("canvases")
          .update({ master_line_color: color })
          .eq("id", canvasId);
      }
    },
    []
  );

  return {
    edgeStyle,
    edgeStyleRef,
    handleEdgeStyleChange,
    edgeColor,
    edgeColorRef,
    handleEdgeColorChange,
    masterLineStyle,
    masterLineStyleRef,
    handleMasterLineStyleChange,
    masterLineColor,
    masterLineColorRef,
    handleMasterLineColorChange,
  };
}
