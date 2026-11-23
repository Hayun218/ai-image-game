import type { Metadata, Viewport } from "next";
import { DEFAULT_THEME, THEME_INIT_SCRIPT } from "@/components/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI or Human?",
  description: "AI가 만든 사진을 찾아라",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#23286b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme 은 아래 스크립트가 첫 페인트 전에 바꿀 수 있어서 hydration 경고를 끈다
    <html lang="ko" data-theme={DEFAULT_THEME} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
