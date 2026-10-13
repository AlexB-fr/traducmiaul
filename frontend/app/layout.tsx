import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cat Meow Translator",
  description: "Record a cat meow, get a humorous translation."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">{children}</body>
    </html>
  );
}
