import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Stat11",
  description: "Futbolun veri merkezi"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
