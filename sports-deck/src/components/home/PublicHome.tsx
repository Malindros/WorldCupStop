import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const featureBlocks = [
  {
    title: "Live Discussions",
    body: "Jump into dedicated discussion threads for every match. Share predictions, celebrate wins, and connect with fans in real-time.",
    image: "/images/atmosphere/stadium-night-wide.png",
    alt: "Match under stadium lights",
  },
  {
    title: "Community & Social",
    body: "Build your personalized feed by following other fans and your favorite teams. Stay updated on new match threads, fan activity, and league standings all in one place.",
    image: "/images/atmosphere/stadium-modern-lights.png",
    alt: "Modern stadium interior",
  },
  {
    title: "Smart Insights",
    body: "See the collective mood of match discussions at a glance. Get AI-generated sentiment analysis for each team and a daily digest that summarizes top discussions and key moments you might have missed.",
    image: "/images/atmosphere/pitch-line-diagonal.png",
    alt: "Pitch line detail",
  },
] as const;

const mediaShowcase = [
  {
    title: "Goals",
    image: "/homegif2.gif",
    alt: "Animated football highlight",
  },
  {
    title: "Teamwork",
    image: "/homegif3.gif",
    alt: "Football stadium atmosphere",
  },
  {
    title: "Celebrations",
    image: "/homegif1.gif",
    alt: "Animated crowd scene",
  }
] as const;

export default function PublicHome() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 p-4 sm:p-8">
      <section className="relative min-h-[min(70vh,520px)] overflow-hidden rounded-3xl border border-border shadow-lg sm:min-h-[480px]">
        <Image
          src="/images/atmosphere/hero-stadium-sunset.png"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="(max-width: 768px) 100vw, 1152px"
          aria-hidden
        />
        <div
          className="absolute inset-0 bg-gradient-to-br from-slate-950/74 via-slate-950/52 to-slate-950/24 dark:from-slate-950/82 dark:via-slate-950/60 dark:to-slate-950/34"
          aria-hidden
        />
        <div className="absolute inset-0 bg-[radial-gradient(90%_90%_at_10%_0%,rgba(14,165,233,0.12),transparent_55%),radial-gradient(70%_80%_at_100%_20%,rgba(234,179,8,0.1),transparent_55%)] dark:bg-[radial-gradient(90%_90%_at_10%_0%,rgba(14,165,233,0.2),transparent_55%)]" aria-hidden />
        <div className="relative z-10 flex h-full min-h-[min(70vh,520px)] flex-col justify-end p-6 sm:min-h-[480px] sm:p-10">
          <p className="mb-3 inline-flex w-fit rounded-full bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 shadow-sm backdrop-blur-sm">
            Welcome to SportsDeck
          </p>
          <h1 className="max-w-3xl text-balance text-3xl font-black tracking-tight text-white drop-shadow-sm sm:text-5xl">
            One Platform. Every Match. All the Action.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">
            Follow season standings, dive into match discussions, and connect with fans who share your passion. SportsDeck is the home for every die-hard supporter.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="xl" className="rounded-full px-6 shadow-md">
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild size="xl" variant="secondary" className="rounded-full border border-border/80 bg-background/90 px-6 shadow-sm backdrop-blur-sm">
              <Link href="/login?mode=signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featureBlocks.map((item) => (
          <Link
            key={item.title}
            href="/login"
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted">
              <Image
                src={item.image}
                alt={item.alt}
                fill
                className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 380px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent opacity-80" aria-hidden />
            </div>
            <div className="flex flex-1 flex-col p-5 pt-4">
              <h2 className="text-lg font-semibold">{item.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Discuss Eveything</h2>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {mediaShowcase.map((item) => (
            <Link
              key={item.title}
              href="/login"
              className="group relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  unoptimized={item.image.endsWith(".gif")}
                  className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" aria-hidden />
                <div className="absolute inset-x-0 bottom-0 z-10 p-4">
                  <h3 className="text-lg font-semibold text-white drop-shadow-sm">{item.title}</h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
