import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Footer } from "@/components/footer";
import "@v1/ui/globals.css";
import localFont from "next/font/local";
import { cn } from "@v1/ui/cn";

const DepartureMono = localFont({
  src: "../../../../web/src/fonts/DepartureMono-Regular.woff2",
  variable: "--font-departure-mono",
});

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Create V1",
  description: "An open-source starter kit based on Midday.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          DepartureMono.variable,
          inter.className,
          "antialiased dark",
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
