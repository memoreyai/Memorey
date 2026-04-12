import { create } from "zustand";

interface VaultManagerOverlayState {
  open: boolean;
  setOpen: (open: boolean) => void;
  openManager: () => void;
}

export const useVaultManagerOverlayStore = create<VaultManagerOverlayState>(
  (set) => ({
    open: false,
    setOpen: (open) => set({ open }),
    openManager: () => set({ open: true }),
  })
);
