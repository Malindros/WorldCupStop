import Image from "next/image";
import ThreadList from "@/components/threads/ThreadList";
import DecorativeSportsIconsBackground from "@/components/ui/DecorativeSportsIconsBackground";

export default function ForumPage() {
  return (
    <div className="relative isolate h-full overflow-x-hidden overflow-y-auto">
      <DecorativeSportsIconsBackground className="top-[280px] sm:top-[330px]" />
      <div className="relative z-10 p-8">
        <header className="relative mb-8 overflow-hidden rounded-2xl border border-border shadow-lg">
          <div className="relative aspect-[5/3] min-h-[200px] max-h-[400px] w-full sm:aspect-[2.6/1] sm:min-h-[220px]">
            <Image
              src="/images/atmosphere/Thread-header.jpg"
              alt="Football fans discussing the game"
              fill
              priority
              quality={90}
              className="object-cover object-center"
              sizes="(max-width: 1280px) 100vw, 1280px"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-slate-950/70 via-slate-950/42 to-slate-950/18 dark:from-slate-950/78 dark:via-slate-950/52 dark:to-slate-950/28"
              aria-hidden
            />
            <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
              <h1
                className="mb-2 text-balance text-white drop-shadow-sm"
                style={{ fontFamily: "Roboto Condensed, sans-serif", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 900 }}
              >
                Threads
              </h1>
              <p className="max-w-xl text-white/85 drop-shadow-sm">
                Discuss matches, teams, and everything football
              </p>
            </div>
          </div>
        </header>

        <ThreadList />
      </div>
    </div>
  );
}
