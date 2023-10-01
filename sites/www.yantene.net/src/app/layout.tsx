import "./globals.css";
import type { Metadata } from "next";
import Header from "../components/shared/Header";
import Menu from "../components/shared/Menu";

export const metadata: Metadata = {
  title: "やんてね！",
  description:
    "やんてねの本名や年齢は？彼女はいるの？メンバーとの不仲説は本当？それ以外のすべてを掲載！",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Menu />
        <Header />
      </body>
    </html>
  );
}
