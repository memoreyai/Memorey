export const PLACEHOLDER_VIEWS = {
  canvas: { title: "Canvas", description: "Visual memory graph explorer" },
  import: { title: "Import", description: "Import conversations from AI platforms" },
} as const;

export type PlaceholderViewId = keyof typeof PLACEHOLDER_VIEWS;
