import type { Metadata } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/layout/ThemeContext";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Legallis — Gestão Jurídica & Financeira",
  description: "Software jurídico para advocacia cível e consumerista",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full"><SessionProvider><ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider></SessionProvider></body>
    </html>
  );
}
