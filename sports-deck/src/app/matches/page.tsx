import MatchList from '@/components/matches/MatchList';
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";

export default function MatchesPage() {
  return (
    <div className="relative isolate overflow-hidden">
      <DecorativeSportsIconsBackground className="top-[280px] sm:top-[330px]" />
      <div className="relative z-10">
        <MatchList />
      </div>
    </div>
  );
}
