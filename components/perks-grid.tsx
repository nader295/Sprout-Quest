import { Sun, Shield, Sparkle, Eye, Clock, Hand, Award, Star } from "lucide-react"

const perks = [
  {
    icon: Sun,
    name: "Morning Dew",
    effect: "+2 cm bonus on your first grow after 6 AM local time.",
    tier: "Common",
  },
  {
    icon: Shield,
    name: "Deep Roots",
    effect: "Loss floor protection increased by 50% in every duel.",
    tier: "Common",
  },
  {
    icon: Sparkle,
    name: "Sunkissed",
    effect: "+10% sunbeam yield from every source — grow, duels, events.",
    tier: "Rare",
  },
  {
    icon: Eye,
    name: "Whisperer",
    effect: "Reveals an opponent's stat range before a duel begins.",
    tier: "Rare",
  },
  {
    icon: Clock,
    name: "Evergreen",
    effect: "Grow cooldown reduced by a full hour every day.",
    tier: "Epic",
  },
  {
    icon: Hand,
    name: "Hearthwarden",
    effect: "Earn double rewards on every act of mercy you offer.",
    tier: "Epic",
  },
]

const achievements = [
  { icon: Award, name: "Kind Soul III", detail: "Shown mercy 200 times" },
  { icon: Star, name: "Centenarian", detail: "Reached 100 cm" },
  { icon: Sun, name: "Sunkissed Streak", detail: "30 daily grows in a row" },
  { icon: Hand, name: "Generous Spirit", detail: "Gifted 25 different players" },
]

const tierStyles: Record<string, string> = {
  Common: "bg-muted text-muted-foreground",
  Rare: "bg-secondary text-primary",
  Epic: "bg-accent/30 text-accent-foreground",
}

export function PerksGrid() {
  return (
    <section id="perks" className="border-y border-border bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="flex flex-col gap-4">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Perks &amp; achievements</p>
            <h2 className="text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
              Build the gardener you want to be.
            </h2>
            <p className="text-pretty text-muted-foreground">
              Equip up to six perks at once. Mix steady growers, defensive thickets, and generous mercy boosts. Achievements earn cosmetic frames and gentle stat bumps — never gates.
            </p>

            <div className="mt-4 rounded-3xl border border-border bg-card p-6">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Recent unlocks</p>
              <ul className="mt-4 flex flex-col gap-4">
                {achievements.map(({ icon: Icon, name, detail }) => (
                  <li key={name} className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="flex flex-1 items-baseline justify-between gap-3">
                      <p className="font-medium">{name}</p>
                      <p className="text-sm text-muted-foreground">{detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {perks.map(({ icon: Icon, name, effect, tier }) => (
              <li
                key={name}
                className="group flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${tierStyles[tier]}`}
                  >
                    {tier}
                  </span>
                </div>
                <div>
                  <h3 className="font-serif text-xl font-medium tracking-tight">{name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{effect}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
