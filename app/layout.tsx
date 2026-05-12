import type { Metadata, Viewport } from "next"
import { Inter, Fraunces } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  axes: ["SOFT", "WONK"],
})

export const metadata: Metadata = {
  title: "SproutQuest — A cozy garden game for Telegram chats",
  description:
    "Grow magical sprouts, duel with kindness, unlock perks, and join global monthly events. A wholesome multiplayer game built right into your Telegram group.",
  openGraph: {
    title: "SproutQuest",
    description: "A cozy Telegram chat garden game built on mercy, not malice.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#f5efe0",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} bg-background`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
