import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import BottomTabs from "@/components/BottomTabs";
import PushManager from "@/components/PushManager";
import PageView from "@/components/PageView";
import VerifyGate from "@/components/VerifyGate";
import IosBanner from "@/components/IosBanner";
import Script from "next/script";

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
  other: { "google-adsense-account": "ca-pub-6458901222804186" },
};

export const viewport: Viewport = {
  themeColor: "#5B4FCF",
};

// AdSense審査コード：環境変数 NEXT_PUBLIC_ADSENSE_CLIENT（例: ca-pub-XXXXXXXXXXXXXXXX）が
// 設定されているときだけ読み込む。未設定なら何も出力しない（＝現状は無効・安全）。
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-6458901222804186";

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
          <div className="flex-1 pb-24">
            <VerifyGate>{children}</VerifyGate>
          </div>
          <BottomTabs />
          <PushManager />
          <PageView />
        </AuthProvider>
        {ADSENSE_CLIENT ? (
          <Script
            id="adsbygoogle-init"
            strategy="afterInteractive"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        ) : null}
      </body>
    </html>
  );
}
