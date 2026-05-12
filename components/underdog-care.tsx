import { LifeBuoy, ShieldCheck, Sprout, Handshake } from "lucide-react"

const supports = [
  {
    icon: LifeBuoy,
    title: "Comeback Boost",
    body: "After three losses in a row, your next grow doubles and a free Fertilizer arrives.",
  },
  {
    icon: ShieldCheck,
    title: "Pity Timer",
    body: "Five losses in a week summons a Phoenix Seed that restores you to your weekly average.",
  },
  {
    icon: Handshake,
    title: "Mentor Pairing",
    body: "The bot quietly pairs underdogs with senior gardeners. Both sides earn for the bond.",
  },
  {
    icon: Sprout,
    title: "Bracket Duels",
    body: "Opt-in matchmaking keeps your duels within ±25% of your current height.",
  },
]

export function UnderdogCare() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Designed for late bloomers</p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Nobody gets uprooted from the garden.
          </h2>
          <p className="text-pretty text-muted-foreground">
            Loss-streak players quietly receive support — never punishment. The systems below run silently in the background so chats stay welcoming for newcomers and unlucky players alike.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {supports.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-serif text-xl font-medium tracking-tight">{title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
