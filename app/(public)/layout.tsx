import type { Metadata } from "next";

// Public, no-sidebar shell for the build-in-public page.
export const metadata: Metadata = {
  title: "Building in public",
  description: "Live stats and apps — built in public.",
};

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="public-shell">{children}</div>;
}
