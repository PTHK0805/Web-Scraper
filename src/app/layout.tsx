// src/app/layout.tsx
import type { Metadata, Viewport } from "next"; // Import Viewport
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const inter = Inter({ subsets: ["latin"] });

// --- Metadata --- (Keep your existing good metadata)
export const metadata: Metadata = {
  title: "Media Extractor",
  description: "Extract and download various media types from websites with just a few clicks. Simple, fast, and reliable",
  metadataBase: new URL('https://media-extractor-v2.onrender.com/'), // Good practice!
  authors: [
    {
      name: 'Phyo Thiha Kyaw',
      url: 'https://phyothihakyaw.com',
    },
  ],
  openGraph: {
    title: 'Media Extractor',
    description: 'Extract and download various media types from websites with just a few clicks. Simple, fast, and reliable',
    type: 'website',
    url: 'https://media-extractor-v2.onrender.com/',
    images: '/home.png',
    siteName: 'Media Extractor',
  },
  // Add PWA related metadata which might be helpful for search engines etc.
  applicationName: "Media Extractor",
  appleWebApp: {
    capable: true,
    title: "Media Extractor",
    statusBarStyle: "default", // Or "black-translucent"
  },
  // formatDetection: { // Optional: prevent auto-detection
  //   telephone: false,
  // },
};

// --- Viewport --- (Recommended for theme-color, etc.)
export const viewport: Viewport = {
  themeColor: [ // Provide light and dark theme colors matching your design/manifest
    { media: '(prefers-color-scheme: light)', color: '#ffffff' }, // Example light theme color
    { media: '(prefers-color-scheme: dark)', color: '#09090b' }, // Example dark theme color (match manifest)
  ],
  // width: 'device-width', // Usually default
  // initialScale: 1, // Usually default
  // maximumScale: 1, // Optional: Prevent zooming on mobile
}


export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
      <head>

        {/* 2. Apple Touch Icon (Icon for iOS Home Screen) */}
        {/*    Use the primary icon size (e.g., 192x192 or create a specific apple-touch-icon.png) */}
        <link rel="apple-touch-icon" href="/apple-icon.png"></link>
        {/*    You can add specific sizes if needed: */}
        {/*    <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-icon-180x180.png"> */}

        {/* 3. Apple PWA Title (Already had this, keep it) */}
        <meta name="apple-mobile-web-app-title" content="Media Extractor" />

        {/* 4. Apple PWA Capable (Tells iOS it can be a PWA) */}
        <meta name="apple-mobile-web-app-capable" content="yes" />

        {/* 5. Apple PWA Status Bar Style (Optional: default, black, black-translucent) */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />

        {/* ---- Favicons (Standard Browser Icons) ---- */}
        {/*    Next.js 13+ App Router often uses convention (app/icon.png, app/favicon.ico) */}
        {/*    but explicitly linking is fine too, especially if icons are in /public */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icon0.svg" type="image/svg+xml" />
      </head>
      <body className={`${inter.className} antialiased`}>
      <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
      >
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <main>{children}</main>
        <Toaster richColors closeButton position="top-right" />
      </ThemeProvider>
      </body>
      </html>
  );
}
