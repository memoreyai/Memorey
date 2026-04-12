import "@/lib/immer-config";
import { runEnvCheck } from "@/lib/envCheck";
import type { Metadata } from "next";
import { Syne, Inter, JetBrains_Mono } from "next/font/google";
import { DiffModal } from "@/components/diff/DiffModal";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-syne",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://memorey.co");

const description =
  "Capture, connect, and recall what matters across every AI tool you use — one memory graph, your vaults.";

runEnvCheck();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Memorey — Your memory. For every AI you use.",
  description,
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Memorey",
    title: "Memorey — Your memory. For every AI you use.",
    description,
    url: "/",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Memorey — Your memory. For every AI you use.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Memorey — Your memory. For every AI you use.",
    description,
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeBootScript = `(function(){
  try {
    var t = localStorage.getItem('memorey-theme') || 'dark';
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch (e) {}
})();`;

  return (
    <html
      lang="en"
      className={`${syne.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${inter.className} antialiased`}>
        <TooltipProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
          <DiffModal />
          <Toaster
            theme="system"
            className="toaster"
            toastOptions={{
              classNames: {
                toast:
                  "border-[color:var(--border2)] bg-[color:var(--bg3)] text-[color:var(--text)] shadow-lg",
                success: "border-[color:var(--orange-border)]",
              },
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
