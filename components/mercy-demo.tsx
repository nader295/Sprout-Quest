"use client"

import { useState } from "react"
import Image from "next/image"
import { Heart, Swords, Gift, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

type Choice = "win" | "mercy" | "return"

const choices: { id: Choice; icon: typeof Heart; label: string; outcome: string; note: string }[] = [
  {
    id: "win",
    icon: Swords,
    label: "Take full reward",
    outcome: "You win the full 20 cm wager.",
    note: "Standard victory — your opponent loses their stake.",
  },
  {
    id: "mercy",
    icon: Heart,
    label: "Show mercy",
    outcome: "You take 10 cm. Bob keeps 10 cm and gains a Grace Token.",
    note: "Earns you a Kind Soul achievement point.",
  },
  {
    id: "return",
    icon: Gift,
    label: "Return everything",
    outcome: "Bob keeps all 20 cm and gets +20% growth for 24 hours.",
    note: "You unlock the Hearthwarden frame for your name.",
  },
]

export function MercyDemo() {
  const [choice, setChoice] = useState<Choice>("mercy")
  const selected = choices.find((c) => c.id === choice)!

  return (
    <section id="mercy" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
        <div className="order-2 lg:order-1">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-border bg-secondary shadow-xl">
            <Image
              src="/mercy-scene.jpg"
              alt="Two friendly sprout characters facing each other, with the taller extending a leaf in a gesture of mercy"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 520px, 90vw"
            />
          </div>
        </div>

        <div className="order-1 flex flex-col gap-6 lg:order-2">
          <p className="text-sm font-medium uppercase tracking-widest text-primary">Mercy mechanic</p>
          <h2 className="text-balance font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            Winning is a choice. Kindness is rewarded.
          </h2>
          <p className="text-pretty text-lg leading-relaxed text-muted-foreground">
            Every battle ends with a 15-second window where the winner picks how the rewards land. There is no shame path — even full victory is encouraged. But the bot tracks generosity over time, and the garden notices.
          </p>

          <div className="rounded-3xl border border-border bg-card p-2 shadow-sm">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {choices.map(({ id, icon: Icon, label }) => {
                const active = choice === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setChoice(id)}
                    aria-pressed={active}
                    className={cn(
                      "flex flex-col items-start gap-2 rounded-2xl border p-4 text-left text-sm transition-all",
                      active
                        ? "border-primary bg-secondary text-foreground shadow-inner"
                        : "border-transparent text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                        active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="font-medium text-foreground">{label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-2 rounded-2xl bg-secondary/50 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="font-medium text-foreground">{selected.outcome}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{selected.note}</p>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Players also see a guaranteed minimum return floor on every wager — nobody gets wiped out of the garden.
          </p>
        </div>
      </div>
    </section>
  )
}
