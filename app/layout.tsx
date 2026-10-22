import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Humaniti AI",
  description: "Evidence-first online class assessment foundation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
