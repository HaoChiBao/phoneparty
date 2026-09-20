import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bearlympics",
  applicationName: "Bearlympics",
  description: "Phone gyro remotes for a shared 3D room.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  preload("/field.jpg", { as: "image" });
  preload("/landing-poster.jpg", { as: "image" });
  preload("/landing-sign.png", { as: "image" });
  preload("/bearlympics.png", { as: "image" });
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-white font-sans text-black antialiased">
        {children}
      </body>
    </html>
  );
}
