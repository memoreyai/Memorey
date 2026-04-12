import { MemoryGraph } from "@/components/graph/MemoryGraph";
import { ExportPanel } from "@/components/export/ExportPanel";
import { TrackPageView } from "@/components/analytics/TrackPageView";

export default function GraphPage() {
  return (
    <div
      className="flex h-[calc(100vh-1px)] min-h-0 flex-col"
      style={{ backgroundColor: "#0A0A0B" }}
    >
      <TrackPageView pagePath="/graph" />
      <MemoryGraph />
      <ExportPanel />
    </div>
  );
}
