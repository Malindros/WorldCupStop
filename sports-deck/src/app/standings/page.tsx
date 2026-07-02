export const dynamic = "force-dynamic";

import Standings from "@/components/standings/Standings";
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";

export default function StandingsPage() {
  return (
    <div className="relative isolate overflow-hidden">
      <DecorativeSportsIconsBackground className="top-[280px] sm:top-[330px]" />
      <div className="relative z-10 p-6">
        <Standings />
      </div>
    </div>
  );
}
