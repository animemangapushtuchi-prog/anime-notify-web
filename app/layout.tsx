import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import BottomTabs from "@/components/BottomTabs";
import PushManager from "@/components/PushManager";
import IosBanner from "@/components/IosBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "アニメ・漫画 新着通知",
  description: "登録した作品の新話放送・配信入りを自動で通知するアプリ（Web版）",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "アニメ通知", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#5B4FCF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <SiteHeader />
          <IosBanner />
          <div className="flex-1 pb-24">{children}</div>
          <BottomTabs />
          <PushManager />
        </AuthProvider>
      </body>
    </html>
  );
}
