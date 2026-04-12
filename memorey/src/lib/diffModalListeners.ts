/**
 * Optional listeners for DiffModal (e.g. onboarding completion).
 * Registered from pages; read by DiffModal in layout.
 */
export const diffModalListeners: {
  onConfirmed: ((count: number) => void) | null;
  onRejected: (() => void) | null;
} = {
  onConfirmed: null,
  onRejected: null,
};
