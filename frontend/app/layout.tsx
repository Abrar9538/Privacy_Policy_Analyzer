import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrivacyLens AI — Privacy Policy Analyzer",
  description: "Understand how a privacy policy handles your data, with evidence you can verify.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
