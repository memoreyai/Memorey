/**
 * Deletes all user-generated content: events, proposals, attachments,
 * history, edges, nodes, canvas_vaults, canvases, vaults (then re-seeds defaults),
 * monthly usage, and storage files.
 *
 * Does NOT delete: profiles row, subscriptions row, auth.users record.
 * This is a "reset data" operation, not full account deletion.
 * For full GDPR deletion, implement a separate endpoint that also
 * calls supabase.auth.admin.deleteUser().
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";

const DEFAULT_VAULTS: {
  name: string;
  color: string;
  display_order: number;
}[] = [
  { name: "Work", color: "#378ADD", display_order: 1 },
  { name: "Goals", color: "#7F77DD", display_order: 2 },
  { name: "Personal", color: "#5DCAA5", display_order: 3 },
  { name: "Health", color: "#E05C5C", display_order: 4 },
  { name: "Finance", color: "#EF9F27", display_order: 5 },
  { name: "Study", color: "#D4537E", display_order: 6 },
  { name: "Relationships", color: "#38BDF8", display_order: 7 },
  { name: "Preferences", color: "#888780", display_order: 8 },
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`delete-all-data:${user.id}`, 3, 60)).allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    let body: { confirm?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: 'Type "DELETE" to confirm.' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const userId = user.id;
    const errors: string[] = [];

    const { error: eventsErr } = await admin
      .from("user_events")
      .delete()
      .eq("user_id", userId);
    if (eventsErr) errors.push(`user_events: ${eventsErr.message}`);

    const { error: proposalsErr } = await admin
      .from("pending_proposals")
      .delete()
      .eq("user_id", userId);
    if (proposalsErr)
      errors.push(`pending_proposals: ${proposalsErr.message}`);

    const { error: attachmentsErr } = await admin
      .from("node_attachments")
      .delete()
      .eq("user_id", userId);
    if (attachmentsErr)
      errors.push(`node_attachments: ${attachmentsErr.message}`);

    const { error: historyErr } = await admin
      .from("node_history")
      .delete()
      .eq("user_id", userId);
    if (historyErr) errors.push(`node_history: ${historyErr.message}`);

    const { error: edgesErr } = await admin
      .from("node_edges")
      .delete()
      .eq("user_id", userId);
    if (edgesErr) errors.push(`node_edges: ${edgesErr.message}`);

    const { error: nodesErr } = await admin
      .from("memory_nodes")
      .delete()
      .eq("user_id", userId);
    if (nodesErr) errors.push(`memory_nodes: ${nodesErr.message}`);

    const { data: canvasRows, error: canvasIdsErr } = await admin
      .from("canvases")
      .select("id")
      .eq("user_id", userId);
    if (canvasIdsErr) {
      errors.push(`canvases (select): ${canvasIdsErr.message}`);
    } else {
      const canvasIds = (canvasRows ?? []).map((r) => r.id as string);
      if (canvasIds.length > 0) {
        const { error: canvasVaultsErr } = await admin
          .from("canvas_vaults")
          .delete()
          .in("canvas_id", canvasIds);
        if (canvasVaultsErr)
          errors.push(`canvas_vaults: ${canvasVaultsErr.message}`);
      }
    }

    const { error: canvasesErr } = await admin
      .from("canvases")
      .delete()
      .eq("user_id", userId);
    if (canvasesErr) errors.push(`canvases: ${canvasesErr.message}`);

    const { error: vaultsDelErr } = await admin
      .from("category_vaults")
      .delete()
      .eq("user_id", userId);
    if (vaultsDelErr)
      errors.push(`category_vaults: ${vaultsDelErr.message}`);

    if (!vaultsDelErr) {
      const rows = DEFAULT_VAULTS.map((v, i) => ({
        user_id: userId,
        name: v.name,
        color: v.color,
        display_order: v.display_order,
        is_custom: false,
        is_active: i < 3,
      }));
      const { error: vaultsInsErr } = await admin
        .from("category_vaults")
        .insert(rows);
      if (vaultsInsErr) {
        console.error(
          "Failed to re-seed category_vaults:",
          vaultsInsErr.message
        );
      }
    }

    if (errors.length > 0) {
      console.error("Partial delete failure:", errors);
      return NextResponse.json(
        {
          ok: false,
          error:
            "Some data could not be deleted. Please try again or contact support.",
          details: errors,
        },
        { status: 500 }
      );
    }

    const { error: usageErr } = await admin
      .from("user_monthly_usage")
      .delete()
      .eq("user_id", userId);
    if (usageErr)
      console.error(
        "Failed to delete user_monthly_usage:",
        usageErr.message
      );

    const bucket = admin.storage.from("node-attachments");
    const listLimit = 1000;
    let offset = 0;
    for (;;) {
      const { data: files, error: listErr } = await bucket.list(userId, {
        limit: listLimit,
        offset,
      });
      if (listErr) {
        console.error(
          "Failed to list node-attachments:",
          listErr.message
        );
        break;
      }
      if (!files?.length) break;
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: storageRemoveErr } = await bucket.remove(paths);
      if (storageRemoveErr)
        console.error(
          "Failed to remove node-attachments files:",
          storageRemoveErr.message
        );
      if (files.length < listLimit) break;
      offset += listLimit;
    }

    const { error: resetEventErr } = await admin.from("user_events").insert({
      user_id: userId,
      event_name: "data_reset",
      event_data: { source: "delete_all_data" },
      page_path: null,
    });
    if (resetEventErr) {
      console.error(
        "Failed to record data_reset event:",
        resetEventErr.message
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[user/delete-all-data]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
