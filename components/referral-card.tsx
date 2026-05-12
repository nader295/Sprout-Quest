"use client"

import { useState } from "react"
import { Copy, Check, Users, Gift, Ticket } from "lucide-react"

const tiers = [
  { count: 5, reward: "Spring frame", unlocked: true },
  { count: 10, reward: "+1 perk slot", unlocked: true },
  { count: 25, reward: "Mythic seed", unlocked: false },
  { count: 50, reward: "Eternal Grove title", unlocked: false },
]

export function ReferralCard() {
  const [copied, setCopied] = useState(false)
  const code = "SPROUT-ALICE-7K2"

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <section id="referrals" className="border-y border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="flex flex-col gap-5">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Referral promo codes</p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Invite a friend. Both gardens grow.
          </h2>
          <p className="text-pretty text-muted-foreground">
            Each player gets one personal code. When a referred friend reaches 25 cm, you both receive sunbeams and a small permanent height bonus. Anti-abuse rules borrowed straight from the original promo-code system.
          </p>

          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Gift className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">For your friend</p>
                <p className="text-xs text-muted-foreground">50 sunbeams + Fertilizer starter</p>
              </div>
            </li>
            <li className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Users className="mt-0.5 h-5 w-5 text-primary" aria-hidden />
              <div>
                <p className="text-sm font-medium">For you</p>
                <p className="text-xs text-muted-foreground">30 sunbeams + 1 cm, up to 50 referrals</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Your personal code</p>
              <p className="mt-1 font-mono text-2xl tracking-tight text-foreground">{code}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary">
              <Ticket className="h-5 w-5" aria-hidden />
            </span>
          </div>

          <button
            type="button"
            onClick={copy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all hover:-translate-y-0.5"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden /> Code copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden /> Copy code
              </>
            )}
          </button>

          <div className="mt-8">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Referral progress</span>
              <span className="tabular-nums text-muted-foreground">12 / 50 friends</span>
            </div>
            <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: "24%" }} />
            </div>

            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {tiers.map(({ count, reward, unlocked }) => (
                <li
                  key={count}
                  className={`flex flex-col gap-1 rounded-2xl border p-3 text-left ${
                    unlocked ? "border-primary/50 bg-secondary" : "border-border bg-card"
                  }`}
                >
                  <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{count}+</span>
                  <span className={`text-sm font-medium ${unlocked ? "text-foreground" : "text-muted-foreground"}`}>
                    {reward}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
