import { z } from "zod";

const MEMORY_SOURCES = [
  "chat",
  "share_link",
  "manual",
  "import",
  "extension",
  "canvas-drop",
] as const;

/** API + client: create memory node (POST /api/memory/create) */
export const memoryNodeCreateBodySchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  vaultId: z.string().min(1, "Vault is required"),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(100, "Title must be at most 100 characters"),
  value: z
    .string()
    .max(600, "Description must be at most 600 characters")
    .optional()
    .default(""),
  confidence: z.number().min(0).max(1).optional().default(1),
  source: z.enum(MEMORY_SOURCES).optional().default("chat"),
  canvasId: z.union([z.string().min(1), z.null()]).optional(),
  /** Overrides `source` in user_events only (e.g. kanban_quick_add, paste); not stored on memory_nodes. */
  analyticsSource: z.string().max(64).optional(),
  /** Kanban board placement (optional; validated server-side against columns). */
  kanbanColumnId: z.string().uuid().optional().nullable(),
  kanbanOrder: z.number().optional(),
  kanbanStatus: z.enum(["todo", "doing", "done"]).nullable().optional(),
});

export type MemoryNodeCreateBody = z.infer<typeof memoryNodeCreateBodySchema>;

/** Hex color including #RRGGBB or #RGB */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(
    /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
    "Color must be a valid hex (e.g. #5DCAA5)"
  );

export const vaultCreateBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Vault name is required")
    .max(120, "Name is too long"),
  color: hexColorSchema.optional().default("#5DCAA5"),
  icon_key: z.string().trim().max(80).nullable().optional(),
});

export type VaultCreateBody = z.infer<typeof vaultCreateBodySchema>;

const USER_SEGMENTS = [
  "founder",
  "developer",
  "consultant",
  "researcher",
  "student",
  "designer",
  "other",
] as const;

const AI_USE_CASES = [
  "strategic_thinking",
  "writing_content",
  "coding_technical",
  "research",
  "decision_making",
] as const;

const MEMORY_GOALS = [
  "decisions",
  "ideas",
  "goals",
  "knowledge",
  "tasks",
  "people",
] as const;

const PRIMARY_USE_CASES = [
  "personal_productivity",
  "work_projects",
  "learning",
  "health_wellness",
  "building",
  "team_collaboration",
] as const;

/** Profile onboarding PATCH — fields optional; validate enums when present */
export const onboardingProfilePatchSchema = z
  .object({
    display_name: z.string().max(100).optional(),
    master_node_bio: z.string().max(500).nullable().optional(),
    segment: z.enum(USER_SEGMENTS).nullable().optional(),
    ai_use_cases: z.array(z.enum(AI_USE_CASES)).optional(),
    memory_goals: z.array(z.enum(MEMORY_GOALS)).optional(),
    primary_use_case: z.enum(PRIMARY_USE_CASES).nullable().optional(),
    onboarding_step: z.number().int().min(0).max(10).optional(),
    onboarding_completed: z.boolean().optional(),
  })
  .strict();

export type OnboardingProfilePatch = z.infer<typeof onboardingProfilePatchSchema>;

export const extractNodesBodySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Text is required")
    .max(50_000, "Text is too long"),
});

const graphBuilderChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .min(1, "Message content is required")
    .max(100_000, "Message content is too long"),
});

/** POST /api/graph-builder — provide either `message` or `messages` */
export const graphBuilderBodySchema = z
  .object({
    message: z
      .string()
      .trim()
      .max(100_000, "Message is too long")
      .optional(),
    messages: z.array(graphBuilderChatMessageSchema).max(100).optional(),
    vaults: z
      .array(
        z.object({
          id: z.string().min(1, "Vault id is required"),
          name: z.string().min(1, "Vault name is required"),
        })
      )
      .max(500)
      .default([]),
    canvasId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .superRefine((data, ctx) => {
    const hasMessage = Boolean(data.message?.length);
    const hasMessages = (data.messages?.length ?? 0) > 0;
    if (!hasMessage && !hasMessages) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either message or messages",
        path: ["message"],
      });
    }
  });

export type GraphBuilderBody = z.infer<typeof graphBuilderBodySchema>;

export const kanbanColumnCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: hexColorSchema.optional(),
  canvasId: z.string().uuid().optional(),
});

export const kanbanColumnPatchSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  color: hexColorSchema.optional(),
  display_order: z.number().int().min(0).optional(),
});

export const kanbanColumnsReorderSchema = z.object({
  columnIds: z.array(z.string().uuid()).min(1),
});

/** POST /api/nodes/create-file */
export const fileNodeCreateBodySchema = z.object({
  vaultId: z.string().uuid("Invalid vault ID"),
  canvasId: z.string().uuid("Invalid canvas ID").optional(),
  fileUrl: z.string().url("Invalid file URL"),
  fileName: z.string().min(1, "File name is required").max(500),
  fileType: z.string().min(1).max(100),
  fileSize: z.number().int().nonnegative().optional(),
  storagePath: z.string().max(1000).optional(),
  thumbnailUrl: z.string().url().optional().or(z.literal("")),
  ogTitle: z.string().max(200).optional(),
  ogDescription: z.string().max(1000).optional(),
  ogImage: z.string().url().optional().or(z.literal("")),
  ogSiteName: z.string().max(200).optional(),
  posX: z.number().finite().optional(),
  posY: z.number().finite().optional(),
});
