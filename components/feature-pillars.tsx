import { Sprout, Heart, Trophy, CalendarHeart, Store, Ticket } from "lucide-react"

const pillars = [
  {
    icon: Sprout,
    title: "Daily growth",
    body: "One /grow per day raises your sprout. No shrinking past your weekly floor — late bloomers are protected.",
  },
  {
    icon: Heart,
    title: "Mercy duels",
    body: "Win a battle and choose: take the prize, split it kindly, or return everything. Kindness earns badges.",
  },
  {
    icon: Trophy,
    title: "Perks & achievements",
    body: "Equip up to six perks, climb cosmetic ranks, and unlock title frames for the way you play.",
  },
  {
    icon: CalendarHeart,
    title: "Monthly events",
    body: "From Frost Festival to Harvest Moon, twelve global events bring fresh mechanics every month.",
  },
  {
    icon: Ticket,
    title: "Referral codes",
    body: "Generate a personal invite. Both you and your friend get sunbeams when their sprout reaches 25 cm.",
  },
  {
    icon: Store,
    title: "Integrated shop",
    body: "Spend sunbeams or Telegram Stars on consumables, cosmetics, and gifts for friends. Never pay to win.",
  },
]

export function FeaturePillars() {
  return (
    <section className="border-y border-border bg-card/60" id="how-it-works">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">The garden, end to end</p>
            <h2 className="mt-2 text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
              Six small joys that keep the chat coming back.
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-muted-foreground">
            Each pillar is a Telegram-native command — no apps to install, no accounts to create.
          </p>
        </div>

        <ul className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex flex-col gap-3 bg-card p-6 transition-colors hover:bg-secondary/40">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-serif text-xl font-medium tracking-tight">{title}</h3>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
