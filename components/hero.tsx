import Image from "next/image"
import { Send, ArrowRight, Heart } from "lucide-react"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Soft background motifs */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, var(--color-primary) 1px, transparent 1px), radial-gradient(circle at 80% 60%, var(--color-accent) 1px, transparent 1px)",
          backgroundSize: "40px 40px, 56px 56px",
        }}
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Now blooming — open beta
          </span>

          <h1 className="text-balance font-serif text-5xl font-medium leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            A cozy chat game built on <em className="not-italic text-primary">kindness</em>, not chaos.
          </h1>

          <p className="max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            SproutQuest turns your Telegram group into a magical garden. Grow your sprout each day, duel friends with a mercy mechanic, unlock perks, and join global monthly events — all without leaving the chat.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://t.me/SproutQuestBot"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Send className="h-4 w-4" aria-hidden />
              Add SproutQuest to Telegram
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              See how it works
              <ArrowRight className="h-4 w-4" aria-hidden />
            </a>
          </div>

          <dl className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-accent" aria-hidden />
              <dt className="text-muted-foreground">Mercy shown</dt>
              <dd className="font-medium tabular-nums">142,309 times</dd>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
              <dt className="text-muted-foreground">Active gardens</dt>
              <dd className="font-medium tabular-nums">8,471</dd>
            </div>
          </dl>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-secondary shadow-xl">
            <Image
              src="/hero-sprout.jpg"
              alt="A friendly watercolor sprout character growing from a terracotta pot, surrounded by gentle botanical motifs"
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 480px, 90vw"
            />
          </div>

          {/* Floating stat card */}
          <div className="absolute -bottom-6 -left-6 hidden w-64 rounded-2xl border border-border bg-card p-4 shadow-lg sm:block">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Your sprout — today</span>
              <span className="rounded-full bg-accent/30 px-2 py-0.5 font-medium text-accent-foreground">+12 cm</span>
            </div>
            <div className="mt-2 font-serif text-2xl font-medium tabular-nums">87 cm</div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-[72%] rounded-full bg-primary" />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>Sapling</span>
              <span>Next: Bloom</span>
            </div>
          </div>

          {/* Floating chat bubble */}
          <div className="absolute -right-3 top-6 hidden max-w-[220px] rounded-2xl rounded-tr-sm border border-border bg-card p-3 text-sm shadow-md md:block">
            <div className="text-xs font-medium text-muted-foreground">@gardenfriends</div>
            <p className="mt-1 leading-snug">
              <span className="text-primary">Alice</span> showed mercy to <span className="text-primary">Bob</span> and earned a Kind Soul badge.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
