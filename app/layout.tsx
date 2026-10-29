
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fredoka } from "next/font/google";

import PublicHeader from "@/components/PublicHeader";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-ace-fredoka",
});

export const metadata: Metadata = {
  title: {
    default: "ACELingua",
    template: "%s | ACELINGUA",
  },

  description:
    "Learn languages through real conversations, interactive lessons, and new worlds to explore with Ace.",

  applicationName: "ACELINGUA",

  icons: {
    icon: "/logoace.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f9f2ff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
    >
      <head>
        <link
          rel="preconnect"
          href="https://cdnjs.cloudflare.com"
          crossOrigin="anonymous"
        />

        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.3.1/css/all.min.css"
        />
      </head>

      <body className={fredoka.variable}>
        <PublicHeader
          logoSrc="/logoace.png"
          headIconSrc="/icon%20head.png"
          signUpHref="/register"
          loginHref="/login"
          sticky
          publicPaths={[
            "/",
            "/about",
            "/languages",
            "/contact",
          ]}
        />

        {children}
      </body>
    </html>
  );
}
