import type { Metadata } from "next"
import { Instrument_Serif, JetBrains_Mono } from "next/font/google"
import "./globals.css"

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
})

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "DSA Drafter — Think before you code",
  description:
    "A drafting journal for algorithmic problems. Work through structure, invariants, and edges before you touch the keyboard.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${mono.variable} h-full antialiased dark`}
      style={{ colorScheme: "dark" }}
    >
      <body className="min-h-full flex flex-col grain bg-ink text-cream">
        {children}
      </body>
    </html>
  )
}
