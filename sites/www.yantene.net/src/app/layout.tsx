"use client";

import "./globals.css";
import type { Metadata } from "next";
import Header from "../components/shared/Header";
import Footer from "../components/shared/Footer";
import Menu from "../components/shared/Menu";
import { MenuContext } from "../contexts/MenuContext";
import { useState } from "react";

const metadata: Metadata = {
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
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = () => setMenuOpen((prev) => !prev);

  return (
    <html lang="ja">
      <body>
        <MenuContext.Provider value={{ menuOpen, toggle }}>
          {children}
          <Menu />
          <Header />
          <Footer />
        </MenuContext.Provider>
      </body>
    </html>
  );
}
