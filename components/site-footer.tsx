import { Sprout } from "lucide-react"

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card/60">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div className="max-w-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Sprout className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-serif text-xl font-medium tracking-tight">SproutQuest</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            A wholesome reimagining of the chat-game genre. Built in Rust, runs anywhere Telegram does.
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:grid-cols-3">
          <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">
            How it works
          </a>
          <a href="#mercy" className="text-muted-foreground transition-colors hover:text-foreground">
            Mercy duels
          </a>
          <a href="#events" className="text-muted-foreground transition-colors hover:text-foreground">
            Events
          </a>
          <a href="#shop" className="text-muted-foreground transition-colors hover:text-foreground">
            Shop
          </a>
          <a href="#referrals" className="text-muted-foreground transition-colors hover:text-foreground">
            Referrals
          </a>
          <a href="#commands" className="text-muted-foreground transition-colors hover:text-foreground">
            Commands
          </a>
          <a href="https://github.com" className="text-muted-foreground transition-colors hover:text-foreground">
            Source
          </a>
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
            Privacy
          </a>
          <a href="#" className="text-muted-foreground transition-colors hover:text-foreground">
            Press kit
          </a>
        </nav>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} SproutQuest. Tended with care.</p>
          <p>Open source under the MIT license.</p>
        </div>
      </div>
    </footer>
  )
}
