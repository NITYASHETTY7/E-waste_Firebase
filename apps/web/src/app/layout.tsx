import "./globals.css";
import type { Metadata } from "next";
import { Space_Grotesk, Manrope } from "next/font/google";
import { AppProvider } from "@/context/AppContext";
import ThemeWrapper from "@/components/shared/ThemeWrapper";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "We Connect Vendors LLP | India's Smart E-Waste Auction & Compliance Platform",
  description:
    "Connecting Waste to Value. Sell your e-waste to verified recyclers through a transparent bidding system. Ensure compliance, maximize value, and simplify disposal.",
  keywords: ["e-waste", "recycling", "circular economy", "sustainable", "bidding", "compliance"],
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${manrope.variable} dark`}
      suppressHydrationWarning
    >
      <head />
      <body suppressHydrationWarning>
        <div className="bg-orb-1"></div>
        <div className="bg-orb-2"></div>
        <div className="bg-orb-3"></div>
        <AppProvider>
          <ThemeWrapper>{children}</ThemeWrapper>
        </AppProvider>
      </body>
    </html>
  );
}
