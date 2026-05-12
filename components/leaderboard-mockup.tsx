import { Crown, Heart, Sparkles, TrendingUp } from "lucide-react"

const garden = [
  { rank: 1, name: "Mira", height: 312, change: 14, mercy: 47, stage: "Mythical Grove" },
  { rank: 2, name: "Oren", height: 289, change: 8, mercy: 12, stage: "Ancient Tree" },
  { rank: 3, name: "Saoirse", height: 244, change: -3, mercy: 91, stage: "Ancient Tree", isKind: true },
  { rank: 4, name: "Theo", height: 198, change: 11, mercy: 6, stage: "Bloom" },
  { rank: 5, name: "Anya", height: 172, change: 9, mercy: 22, stage: "Bloom" },
  { rank: 6, name: "Kenji", height: 141, change: 5, mercy: 18, stage: "Sapling" },
  { rank: 7, name: "Lior", height: 88, change: 15, mercy: 4, stage: "Sapling", isComeback: true },
]

const stageColor: Record<string, string> = {
  "Mythical Grove": "bg-accent/40 text-accent-foreground",
  "Ancient Tree": "bg-primary/15 text-primary",
  Bloom: "bg-secondary text-primary",
  Sapling: "bg-muted text-muted-foreground",
}

export function LeaderboardMockup() {
  return (
    <section className="border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">Inside a real chat</p>
            <h2 className="mt-2 text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
              The garden everyone tends together.
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-muted-foreground">
            Type <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">/garden</code> in any chat to see the live leaderboard, stages, and weekly trends.
          </p>
        </div>

        <div className="mt-10 overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-primary">
                <Sparkles className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="font-serif text-lg font-medium leading-tight">Garden Friends</p>
                <p className="text-xs text-muted-foreground">42 gardeners · updated 2 min ago</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <TrendingUp className="h-4 w-4 text-primary" aria-hidden />
              Weekly growth +8.4%
            </div>
          </div>

          <ul role="list" className="divide-y divide-border">
            {garden.map((row) => {
              const gaining = row.change >= 0
              return (
                <li
                  key={row.rank}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-4 transition-colors hover:bg-secondary/40 sm:grid-cols-[auto_1.4fr_1fr_auto_auto]"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-mono text-sm tabular-nums text-muted-foreground">
                    {row.rank === 1 ? <Crown className="h-4 w-4 text-accent-foreground" aria-hidden /> : row.rank}
                  </span>

                  <div className="flex min-w-0 flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{row.name}</p>
                      {row.isKind && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
                          <Heart className="h-3 w-3" aria-hidden /> Kind Soul
                        </span>
                      )}
                      {row.isComeback && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                          Comeback boost
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{row.mercy} mercies shown this season</p>
                  </div>

                  <div className="hidden items-center gap-2 sm:flex">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider ${stageColor[row.stage]}`}
                    >
                      {row.stage}
                    </span>
                  </div>

                  <div className="text-right">
                    <p className="font-serif text-lg font-medium tabular-nums">{row.height} cm</p>
                    <p
                      className={`text-xs tabular-nums ${gaining ? "text-primary" : "text-muted-foreground"}`}
                      aria-label={`changed by ${row.change} centimeters`}
                    >
                      {gaining ? "+" : ""}
                      {row.change} today
                    </p>
                  </div>

                  <div
                    className="hidden h-10 w-24 items-end gap-0.5 sm:flex"
                    aria-hidden
                  >
                    {[40, 55, 48, 62, 70, 64, 78].map((h, idx) => (
                      <span
                        key={idx}
                        className="flex-1 rounded-sm bg-primary/30"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
