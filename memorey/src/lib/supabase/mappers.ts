import type { NodeAttachment } from "@/types/memorey";

export function mapAttachmentRow(row: Record<string, unknown>): NodeAttachment {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    nodeId: row.node_id != null ? String(row.node_id) : null,
    fileUrl: String(row.file_url),
    fileName: String(row.file_name),
    fileType: row.file_type as NodeAttachment["fileType"],
    mimeType: row.mime_type != null ? String(row.mime_type) : null,
    thumbnailUrl: row.thumbnail_url != null ? String(row.thumbnail_url) : null,
    source: row.source as NodeAttachment["source"],
    sourceFileId:
      row.source_file_id != null ? String(row.source_file_id) : null,
    fileSizeBytes:
      row.file_size_bytes != null ? Number(row.file_size_bytes) : null,
    title: row.title != null ? String(row.title) : null,
    description: row.description != null ? String(row.description) : null,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
  };
}
