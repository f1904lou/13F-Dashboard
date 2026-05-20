import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "13F Fund Dashboard",
  description: "Analyze SEC filers and inspect their latest 13F holdings."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
