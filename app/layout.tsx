import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import Providers from "../components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Used only for big headings, to give the app a bit of personality.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Lockbox: your files on AWS S3",
  description: "Private file storage on AWS S3 with AI-written tags and summaries.",
};

// Runs before the page paints, so a dark-mode user never sees a white flash.
// It uses the saved choice if there is one, otherwise the computer's own light/dark setting.
const themeScript = `(function(){try{var t=localStorage.getItem('cv-theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${instrument.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
