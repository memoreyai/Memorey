import { create } from "zustand";

interface ExportPanelState {
  open: boolean;
  openExportPanel: () => void;
  closeExportPanel: () => void;
}

export const useExportPanelStore = create<ExportPanelState>((set) => ({
  open: false,
  openExportPanel: () => set({ open: true }),
  closeExportPanel: () => set({ open: false }),
}));
