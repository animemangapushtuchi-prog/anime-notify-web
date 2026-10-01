import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Zen_Kaku_Gothic_New } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";
import Sidebar from "@/components/Sidebar";
import BottomTabs from "@/components/BottomTabs";
import Footer from "@/components/Footer";
import PushManager from "@/components/PushManager";
import PageView from "@/components/PageView";
import Reveal from "@/components/Reveal";
import VerifyGate from "@/components/VerifyGate";
import IosBanner from "@/components/IosBanner";
import Script from "next/script";
import { OG_IMAGE } from "@/lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// 見出し（h1・h2）専用の日本語フォント。極太の1種類だけ読み込む。
// 日本語フォントは文字ごとに約120ファイルに分かれて配信され、使った文字のファイルだけが読み込まれる。
// 本文まで使うと太さ4種類で約4.4MBになったため（2026-10 実測）、本文は端末の日本語フォントにしている
const zen = Zen_Kaku_Gothic_New({
  variable: "--font-zen",
  weight: "900",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "アニミル！（Animiru）｜アニメの放送・配信を自動で新着通知";
const SITE_DESC =
  "登録した作品の新話放送・配信入りを自動でお知らせ。放送カレンダー・今期アニメ・おすすめ特集も。アニメ好きのための新着通知サービス「アニミル！」。";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.animiru.com"),
  title: SITE_TITLE,
  description: SITE_DESC,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "アニミル！", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
  other: { "google-adsense-account": "ca-pub-6458901222804186" },
  // SNS・LINEに貼られたときの見え方。各ページが openGraph を持つ場合はそちらで上書きされる。
  // canonical はページごとに違うので、ここには書かない（ここに書くと全ページが同じURLになる）。
  openGraph: {
    type: "website",
    siteName: "アニミル！",
    locale: "ja_JP",
    url: "https://www.animiru.com",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  themeColor: "#FAF6EF",
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
      className={`${geistSans.variable} ${geistMono.variable} ${zen.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-paper text-ink">
        <AuthProvider>
          <div className="lg:flex">
            <Sidebar />
            <div className="flex min-h-screen min-w-0 flex-1 flex-col">
              <SiteHeader />
              <IosBanner />
              <div className="flex-1">
                <VerifyGate>{children}</VerifyGate>
              </div>
            </div>
          </div>
          <Footer />
          <div className="lg:hidden">
            <BottomTabs />
          </div>
          <PushManager />
          <PageView />
          <Reveal />
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
