import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shuffla",
  description: "AI card news studio for generating, editing, and downloading visual content.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
