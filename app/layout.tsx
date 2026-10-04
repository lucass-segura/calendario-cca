import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCA SECTOR 7",
  description: "Reservas de cocina y planificación de comidas de la iglesia.",
  other: {
    "codex-preview": "development",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {capable:true, title:"CCA SECTOR 7",statusBarStyle:"default"},
  icons: {
    apple: "/app-icon-180.png",
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:"#153c50"};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
