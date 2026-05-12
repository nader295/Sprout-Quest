import Link from "next/link"
import { Sprout, Send } from "lucide-react"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sprout className="h-5 w-5" aria-hidden />
          </span>
          <span className="font-serif text-xl font-medium tracking-tight">SproutQuest</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a href="#how-it-works" className="transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#mercy" className="transition-colors hover:text-foreground">
            Mercy duels
          </a>
          <a href="#events" className="transition-colors hover:text-foreground">
            Events
          </a>
          <a href="#shop" className="transition-colors hover:text-foreground">
            Shop
          </a>
          <a href="#commands" className="transition-colors hover:text-foreground">
            Commands
          </a>
        </nav>

        <a
          href="https://t.me/SproutQuestBot"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <Send className="h-4 w-4" aria-hidden />
          Add to chat
        </a>
      </div>
    </header>
  )
}
