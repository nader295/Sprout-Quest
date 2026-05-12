import { Sprout, Droplets, Flame, Gift, Palette, Layers } from "lucide-react"

const items = [
  {
    icon: Droplets,
    name: "Watering Can",
    description: "Skip a single grow cooldown.",
    price: "120",
    currency: "sunbeams",
    tag: "Consumable",
  },
  {
    icon: Sprout,
    name: "Fertilizer",
    description: "Adds +10 cm to your next grow.",
    price: "180",
    currency: "sunbeams",
    tag: "Consumable",
  },
  {
    icon: Flame,
    name: "Phoenix Seed",
    description: "Revive to your 7-day average after losses.",
    price: "1",
    currency: "Telegram Star",
    tag: "Rare",
  },
  {
    icon: Palette,
    name: "Sage Frame",
    description: "Decorative title frame for your name.",
    price: "450",
    currency: "sunbeams",
    tag: "Cosmetic",
  },
  {
    icon: Layers,
    name: "Perk Slot +1",
    description: "Unlock a fourth perk slot, up to six.",
    price: "5",
    currency: "Telegram Stars",
    tag: "Upgrade",
  },
  {
    icon: Gift,
    name: "Gift Bundle",
    description: "Send any item to another player.",
    price: "varies",
    currency: "",
    tag: "Social",
  },
]

export function ShopPreview() {
  return (
    <section id="shop" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="grid items-end gap-3 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-medium uppercase tracking-widest text-primary">The shop</p>
          <h2 className="mt-2 text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Spend kindly. Gift generously.
          </h2>
        </div>
        <p className="text-pretty text-muted-foreground">
          Sunbeams come from playing. Telegram Stars cover premium cosmetics and convenience — never power. Every item can be gifted.
        </p>
      </div>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, name, description, price, currency, tag }) => (
          <li
            key={name}
            className="group flex flex-col justify-between gap-6 rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {tag}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-serif text-xl font-medium tracking-tight">{name}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <div className="flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-serif text-xl tabular-nums">{price}</span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">{currency}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
