import { MemoryGraph } from "@/components/graph/MemoryGraph";
import { UpgradeBanner } from "@/components/ui/UpgradeBanner";
import { TrackPageView } from "@/components/analytics/TrackPageView";

export default function DashboardHomePage() {
  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <TrackPageView pagePath="/dashboard" />
      <UpgradeBanner />
      <div className="min-h-0 flex-1">
        <MemoryGraph />
      </div>
    </div>
  );
}
