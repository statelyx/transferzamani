import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transfer Zamanı | Transfer haberleri, ligler ve ilk 11",
  description: "Transfer haberleri, futbolcu profilleri, ligler, kadrolar ve ilk 11 kurma merkezi."
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
