const EVENT_LABELS: Record<string, string> = {
  node_created: "Created a memory node",
  edge_created: "Connected two memories",
  search_performed: "Searched memories",
  capture_chat_sent: "Sent a capture chat",
  capture_link_ingested: "Ingested a capture link",
  signup_completed: "Completed signup",
  vault_created: "Created a vault",
  canvas_created: "Created a canvas",
  page_view: "Viewed a page",
  onboarding_started: "Started onboarding",
  onboarding_completed: "Completed onboarding",
  share_link_created: "Created a share link",
  export_triggered: "Triggered an export",
};

function humanizeSnake(s: string): string {
  return s
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function labelForEventName(eventName: string): string {
  return EVENT_LABELS[eventName] ?? humanizeSnake(eventName);
}

export function labelForFeatureEvent(eventName: string): string {
  return labelForEventName(eventName);
}

export function formatEventData(data: Record<string, unknown>): string {
  const keys = Object.keys(data);
  if (keys.length === 0) return "";
  try {
    const short: Record<string, unknown> = {};
    for (const k of keys.slice(0, 6)) {
      const v = data[k];
      if (typeof v === "string" && v.length > 80) short[k] = `${v.slice(0, 77)}…`;
      else short[k] = v;
    }
    return JSON.stringify(short);
  } catch {
    return "";
  }
}
