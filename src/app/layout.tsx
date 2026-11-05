import type { Metadata, Viewport } from "next";
import { DemoProvider } from "@/lib/demo-store";
import "./globals.css";

export const metadata: Metadata = {
  title: "싱클 Syncle",
  description: "우리 팀의 대화가 일정이 되는 곳",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#3346D3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Outfit:wght@700&family=Google+Sans:wght@500&display=swap"
        />
      </head>
      <body>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
