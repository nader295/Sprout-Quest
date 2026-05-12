import Image from "next/image"

const events = [
  { month: "Jan", name: "Frost Festival", hook: "Smaller grows, 3× mercy stacks." },
  { month: "Feb", name: "Heart Bloom", hook: "Gift sunbeams for shared XP." },
  { month: "Mar", name: "Spring Rally", hook: "Cross-chat global leaderboard." },
  { month: "Apr", name: "Rain Dance", hook: "Chance of a downpour doubling growth." },
  { month: "May", name: "Pollinator Quest", hook: "Cooperative goal across chats." },
  { month: "Jun", name: "Solstice Surge", hook: "48 hours of doubled growth, capped." },
  { month: "Jul", name: "Fire Garden", hook: "3× wagers — mercy disabled for the brave." },
  { month: "Aug", name: "Harvest Moon", hook: "Exchange sprouts for permanent seeds." },
  { month: "Sep", name: "Wisdom Trials", hook: "Trivia-based growth, no RNG." },
  { month: "Oct", name: "Haunted Hollow", hook: "Cosmetic-only spooky frames." },
  { month: "Nov", name: "Gratitude Grove", hook: "Mercy counts 5× toward badges." },
  { month: "Dec", name: "Winter Lights", hook: "Daily login streak rewards." },
]

const currentMonthIndex = 4 // May highlighted

export function EventCalendar() {
  return (
    <section id="events" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="relative">
          <div className="relative aspect-[5/6] overflow-hidden rounded-3xl border border-border bg-secondary shadow-xl">
            <Image
              src="/garden-event.jpg"
              alt="A warm sunset garden filled with sprouts at every growth stage, glowing under paper lanterns"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 540px, 90vw"
            />
          </div>

          <div className="absolute -right-4 bottom-8 hidden w-60 rounded-2xl border border-border bg-card p-4 shadow-lg md:block">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Live event</p>
            <p className="mt-1 font-serif text-lg font-medium">Pollinator Quest</p>
            <div className="mt-3 flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Chats visited</span>
              <span className="font-medium tabular-nums">3 / 5</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-3/5 rounded-full bg-accent" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Global monthly events</p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            A new garden ritual every month of the year.
          </h2>
          <p className="text-pretty text-muted-foreground">
            Each event has a global leaderboard for the top hundred and a chat-level board so smaller communities still win something. Everyone who shows up at least once leaves with a commemorative badge.
          </p>

          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Monthly event calendar">
            {events.map(({ month, name, hook }, i) => {
              const isNow = i === currentMonthIndex
              return (
                <li
                  key={month}
                  className={`flex flex-col gap-1 rounded-2xl border p-4 text-left transition-colors ${
                    isNow
                      ? "border-primary bg-secondary"
                      : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium uppercase tracking-widest text-muted-foreground">{month}</span>
                    {isNow && (
                      <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                        Now
                      </span>
                    )}
                  </div>
                  <p className="font-serif text-base font-medium leading-tight">{name}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{hook}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
