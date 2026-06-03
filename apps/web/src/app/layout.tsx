import type { Metadata } from "next";
import { Inter, Noto_Sans_JP } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FontSizeProvider } from "@/components/providers/font-size-provider";
import { FONT_SIZE_INIT_SCRIPT } from "@/lib/font-size";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "BRIDGE - 統合業務支援システム",
  description: "建築業界向け統合業務支援Webアプリケーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FONT_SIZE_INIT_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${notoSansJP.variable} font-sans antialiased`}
      >
        <FontSizeProvider>
          <TooltipProvider delayDuration={300}>
            {children}
          </TooltipProvider>
          <Toaster position="top-right" richColors />
        </FontSizeProvider>
      </body>
    </html>
  );
}
