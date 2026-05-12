import { Send } from "lucide-react"

const commands = [
  { cmd: "/grow", desc: "Grow your sprout once per day." },
  { cmd: "/garden", desc: "Show this chat's live leaderboard and stages." },
  { cmd: "/sprout_of_the_day", desc: "See today's biggest growth and the bonus winner." },
  { cmd: "/duel @friend 20", desc: "Challenge a friend, wagering 20 cm." },
  { cmd: "/mercy", desc: "Choose mercy when you win — split, return, or take." },
  { cmd: "/perks", desc: "Manage your six perk slots." },
  { cmd: "/achievements", desc: "Browse badges and frames you've unlocked." },
  { cmd: "/shop", desc: "Open the in-chat shop and gift items." },
  { cmd: "/event", desc: "See the current global event and your standing." },
  { cmd: "/refer", desc: "Get your personal referral code." },
  { cmd: "/help", desc: "List every command available in this chat." },
  { cmd: "/settings", desc: "Per-chat toggles for admins." },
]

export function BotCommands() {
  return (
    <section id="commands" className="border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid items-end gap-4 md:grid-cols-[1.5fr_1fr]">
          <div>
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Telegram commands</p>
            <h2 className="mt-2 text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
              Everything lives in chat. No app required.
            </h2>
          </div>
          <p className="text-pretty text-muted-foreground">
            SproutQuest is a single Rust binary that speaks Telegram. Add it once, type a command, and you&apos;re playing.
          </p>
        </div>

        <ul className="mt-10 grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {commands.map(({ cmd, desc }) => (
            <li key={cmd} className="flex flex-col gap-2 bg-card p-5 transition-colors hover:bg-secondary/50">
              <code className="font-mono text-sm text-primary">{cmd}</code>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-3xl border border-border bg-card p-8 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-serif text-2xl font-medium tracking-tight">Ready to plant the first seed?</h3>
            <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
              Add SproutQuest to your group chat. Everyone gets a free starter pot, a personal referral code, and a welcome from the garden.
            </p>
          </div>
          <a
            href="https://t.me/SproutQuestBot"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
          >
            <Send className="h-4 w-4" aria-hidden />
            Add to Telegram
          </a>
        </div>
      </div>
    </section>
  )
}
