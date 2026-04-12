import { TrackPageView } from "@/components/analytics/TrackPageView";
import { SearchPageClient } from "./SearchPageClient";

export default function DashboardSearchPage() {
  return (
    <>
      <TrackPageView pagePath="/dashboard/search" />
      <SearchPageClient />
    </>
  );
}
