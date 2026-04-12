import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../lib/hooks/useAuth";

export const metadata: Metadata = {
  title: "Open Pass Manager",
  description: "Secure, team-friendly password and secret manager",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
