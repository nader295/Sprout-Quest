import { SiteHeader } from "@/components/site-header"
import { Hero } from "@/components/hero"
import { FeaturePillars } from "@/components/feature-pillars"
import { MercyDemo } from "@/components/mercy-demo"
import { UnderdogCare } from "@/components/underdog-care"
import { PerksGrid } from "@/components/perks-grid"
import { EventCalendar } from "@/components/event-calendar"
import { LeaderboardMockup } from "@/components/leaderboard-mockup"
import { ShopPreview } from "@/components/shop-preview"
import { ReferralCard } from "@/components/referral-card"
import { BotCommands } from "@/components/bot-commands"
import { SiteFooter } from "@/components/site-footer"

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main>
        <Hero />
        <FeaturePillars />
        <MercyDemo />
        <UnderdogCare />
        <PerksGrid />
        <EventCalendar />
        <LeaderboardMockup />
        <ShopPreview />
        <ReferralCard />
        <BotCommands />
      </main>
      <SiteFooter />
    </div>
  )
}
