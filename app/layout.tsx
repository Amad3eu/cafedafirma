import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { REPO_URL } from "@/lib/constants";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Café da Firma · Feitas, xícaras e notas do café",
  description:
    "Registre a feita do café em um clique, conte suas xícaras do dia, avalie como estava o café e veja histórico, gráficos e ranking da equipe.",
  applicationName: "Café da Firma",
  authors: [{ name: "Amad3eu", url: REPO_URL }],
  keywords: ["café", "equipe", "registro", "extensão", "Next.js"],
  other: { "source-code": REPO_URL },
};

export const viewport: Viewport = {
  themeColor: "#241610",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
