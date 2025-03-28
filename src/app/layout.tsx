// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"; // Ensure this path is correct
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/ThemeToggle"; // Import the new component

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Media Extractor",
  description: "Extract and download various media types from websites with just a few clicks. Simple, fast, and reliable",
  metadataBase: new URL('https://media-extractor.phyothihakyaw.com'),
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
    url: 'https://media-extractor.phyothihakyaw.com',
    images: '/home.png',
    siteName: 'Media Extractor',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning is recommended by next-themes
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}> {/* Added antialiased for smoother fonts */}
        <ThemeProvider
            attribute="class" // Use class-based theme switching
            defaultTheme="system" // Default to system preference
            enableSystem // Allow 'system' theme option
            disableTransitionOnChange // Prevent theme transitions on page load
          >
            {/* Position the toggle button */}
            {/* You can adjust positioning as needed (e.g., inside a header component) */}
            <div className="fixed top-4 right-4 z-50">
                 <ThemeToggle />
            </div>

            {/* Main content */}
            <main>{children}</main>

            {/* Toast notifications */}
            <Toaster richColors closeButton position="top-right"/>
        </ThemeProvider>
      </body>
    </html>
  );
}