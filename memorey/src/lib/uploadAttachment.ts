import { createClient } from "@/lib/supabase/client";

const SIGNED_TTL_SEC = 60 * 60; // 1 hour

export interface UploadResult {
  storagePath: string;
  /** Short-lived signed URL for immediate display / open; refresh via storage_path when expired. */
  publicUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

export async function uploadAttachment(
  file: File,
  userId: string
): Promise<UploadResult> {
  const supabase = createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("node-attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: signed, error: signError } = await supabase.storage
    .from("node-attachments")
    .createSignedUrl(uploadData.path, SIGNED_TTL_SEC);

  if (signError || !signed?.signedUrl) {
    throw new Error(
      `Could not create signed URL: ${signError?.message ?? "unknown"}`
    );
  }

  let fileType = "file";
  if (file.type.startsWith("image/")) fileType = "image";
  else if (file.type === "application/pdf") fileType = "pdf";
  else if (file.type.startsWith("video/")) fileType = "video";
  else if (/\.(md|txt)$/i.test(file.name)) fileType = "doc";

  return {
    storagePath: uploadData.path,
    publicUrl: signed.signedUrl,
    fileName: file.name,
    fileType,
    fileSize: file.size,
  };
}
