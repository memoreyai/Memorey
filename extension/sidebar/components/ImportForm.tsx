import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ChatGPTParser,
  ClaudeParser,
  PlainTextParser,
  MarkdownParser,
  JsonParser,
} from "memorey-core";
import type { ConversationExchange, ConversationParser } from "memorey-core";

const FORMAT_OPTIONS = [
  { id: "auto", label: "Auto-detect" },
  { id: "chatgpt", label: "ChatGPT Export" },
  { id: "claude", label: "Claude Export" },
  { id: "plain", label: "Plain Text" },
  { id: "markdown", label: "Markdown" },
  { id: "json", label: "JSON" },
] as const;

const PLATFORM_OPTIONS = [
  { id: "chatgpt", label: "ChatGPT" },
  { id: "claude", label: "Claude" },
  { id: "gemini", label: "Gemini" },
  { id: "perplexity", label: "Perplexity" },
  { id: "other", label: "Other" },
] as const;

type FormatId = (typeof FORMAT_OPTIONS)[number]["id"];

function getParser(formatId: FormatId): ConversationParser | null {
  switch (formatId) {
    case "chatgpt": return new ChatGPTParser();
    case "claude": return new ClaudeParser();
    case "plain": return new PlainTextParser();
    case "markdown": return new MarkdownParser();
    case "json": return new JsonParser();
    default: return null;
  }
}

const ALL_PARSERS: ConversationParser[] = [
  new ChatGPTParser(),
  new ClaudeParser(),
  new JsonParser(),
  new MarkdownParser(),
  new PlainTextParser(),
];

function autoDetectFormat(content: string): { parser: ConversationParser; label: string } | null {
  for (const p of ALL_PARSERS) {
    if (p.canParse(content)) {
      const name = p.constructor.name.replace("Parser", "");
      return { parser: p, label: name };
    }
  }
  return null;
}

interface Preview {
  exchanges: ConversationExchange[];
  detectedFormat: string;
}

interface ImportFormProps {
  onImport: (exchanges: ConversationExchange[], platform: string) => void;
}

export function ImportForm({ onImport }: ImportFormProps) {
  const [format, setFormat] = useState<FormatId>("auto");
  const [platform, setPlatform] = useState("chatgpt");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseContent = useCallback(
    (text: string) => {
      setError(null);
      setPreview(null);

      if (!text.trim()) return;

      try {
        let parser: ConversationParser | null = null;
        let detectedLabel = format;

        if (format === "auto") {
          const detected = autoDetectFormat(text);
          if (!detected) {
            setError("Could not auto-detect format. Please select a format manually.");
            return;
          }
          parser = detected.parser;
          detectedLabel = detected.label;
        } else {
          parser = getParser(format);
        }

        if (!parser) {
          setError("No parser available for this format.");
          return;
        }

        const exchanges = parser.parse(text);
        if (exchanges.length === 0) {
          setError("No conversation exchanges found in the content.");
          return;
        }

        setPreview({ exchanges, detectedFormat: String(detectedLabel) });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse content.");
      }
    },
    [format]
  );

  const handleFileRead = useCallback(
    (file: File) => {
      setFileName(file.name);
      setFileSize(file.size);

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setContent(text);
        parseContent(text);
      };
      reader.onerror = () => setError("Failed to read file.");
      reader.readAsText(file);
    },
    [parseContent]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileRead(file);
    },
    [handleFileRead]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileRead(file);
    },
    [handleFileRead]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      setContent(text);
      setFileName(null);
      setFileSize(0);
    },
    []
  );

  const handleParseClick = useCallback(() => {
    parseContent(content);
  }, [content, parseContent]);

  const handleImport = useCallback(() => {
    if (!preview) return;
    onImport(preview.exchanges, platform);
  }, [preview, platform, onImport]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const previewSample = useMemo(() => {
    if (!preview) return [];
    return preview.exchanges.slice(0, 3);
  }, [preview]);

  const timestamps = useMemo(() => {
    if (!preview || preview.exchanges.length === 0) return null;
    const first = preview.exchanges[0].timestamp;
    const last = preview.exchanges[preview.exchanges.length - 1].timestamp;
    if (!first && !last) return null;
    return { first, last };
  }, [preview]);

  return (
    <div className="memorey-import-form">
      {/* Format selector */}
      <div className="memorey-import-form__field">
        <label className="memorey-import-form__label">Source Format</label>
        <select
          className="memorey-filter-bar__select"
          value={format}
          onChange={(e) => setFormat(e.target.value as FormatId)}
        >
          {FORMAT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Platform tag */}
      <div className="memorey-import-form__field">
        <label className="memorey-import-form__label">Platform</label>
        <select
          className="memorey-filter-bar__select"
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        >
          {PLATFORM_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* File upload drop zone */}
      <div
        className={`memorey-import-form__dropzone${isDragOver ? " memorey-import-form__dropzone--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.txt,.md,.csv"
          onChange={handleFileInput}
          style={{ display: "none" }}
        />
        {fileName ? (
          <div className="memorey-import-form__file-info">
            <span className="memorey-import-form__file-name">{fileName}</span>
            <span className="memorey-import-form__file-size">{formatFileSize(fileSize)}</span>
          </div>
        ) : (
          <div className="memorey-import-form__drop-text">
            Drop a file here or click to browse
          </div>
        )}
      </div>

      {/* OR divider */}
      <div className="memorey-import-form__divider">
        <span>OR</span>
      </div>

      {/* Text paste area */}
      <div className="memorey-import-form__field">
        <label className="memorey-import-form__label">Paste conversation text</label>
        <textarea
          className="memorey-import-form__textarea"
          rows={6}
          placeholder="Paste your conversation export here..."
          value={content}
          onChange={handleTextChange}
        />
        {content.trim() && !preview && (
          <button className="memorey-btn memorey-btn--sm" onClick={handleParseClick}>
            Parse Content
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="memorey-import-form__error">{error}</div>
      )}

      {/* Preview */}
      {preview && (
        <div className="memorey-import-form__preview">
          <div className="memorey-import-form__preview-header">
            <span className="memorey-import-form__preview-title">Preview</span>
            <span className="memorey-import-form__preview-format">
              Format: {preview.detectedFormat}
            </span>
          </div>

          <div className="memorey-import-form__preview-stats">
            <div className="memorey-import-form__preview-stat">
              <span className="memorey-import-form__preview-stat-value">
                {preview.exchanges.length}
              </span>
              <span className="memorey-import-form__preview-stat-label">exchanges</span>
            </div>
            {timestamps && (
              <>
                {timestamps.first && (
                  <div className="memorey-import-form__preview-stat">
                    <span className="memorey-import-form__preview-stat-label">
                      First: {new Date(timestamps.first).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {timestamps.last && (
                  <div className="memorey-import-form__preview-stat">
                    <span className="memorey-import-form__preview-stat-label">
                      Last: {new Date(timestamps.last).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {previewSample.length > 0 && (
            <div className="memorey-import-form__preview-exchanges">
              {previewSample.map((ex, i) => (
                <div key={i} className="memorey-import-form__preview-exchange">
                  <div className="memorey-import-form__preview-user">
                    <strong>User:</strong>{" "}
                    {ex.userMessage.length > 100
                      ? ex.userMessage.slice(0, 97) + "..."
                      : ex.userMessage}
                  </div>
                  <div className="memorey-import-form__preview-assistant">
                    <strong>Assistant:</strong>{" "}
                    {ex.assistantMessage.length > 100
                      ? ex.assistantMessage.slice(0, 97) + "..."
                      : ex.assistantMessage}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="memorey-btn memorey-btn--primary" onClick={handleImport}>
            Import {preview.exchanges.length} Exchanges
          </button>
        </div>
      )}
    </div>
  );
}
