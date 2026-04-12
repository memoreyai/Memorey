import type { FileType } from "@/types/memorey";

export function fileTypeColor(type: FileType): string {
  const colors: Record<FileType, string> = {
    image: "#4FC1E9",
    video: "#FF5B8A",
    pdf: "#E05C5C",
    doc: "#378ADD",
    spreadsheet: "#A8E063",
    presentation: "#F5C542",
    audio: "#C792EA",
    link: "#888780",
    other: "#888780",
  };
  return colors[type] ?? "#888780";
}
