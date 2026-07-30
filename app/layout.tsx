import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LitAssist — Intelligent RRL Analysis Assistant",
  description:
    "An AI-powered chatbot designed to assist researchers in analyzing and synthesizing Review of Related Literature (RRL). Identify key themes, research gaps, trends, and relevant insights from scholarly sources.",
  keywords: ["RRL", "research", "AI", "literature review", "chatbot", "academic"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
