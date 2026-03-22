import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Script Bud — Generación de Guiones Cinematográficos",
  description:
    "Transforma tus transcripciones en guiones profesionales con IA. Tablero visual de beats, evaluación automática y exportación en múltiples formatos.",
  keywords: ["guion", "screenplay", "IA", "cinematografía", "cortometraje"],
  authors: [{ name: "Script Bud" }],
  openGraph: {
    title: "Script Bud",
    description: "Guiones cinematográficos profesionales con IA",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased min-h-screen" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
