import Sidebar from "@/components/Sidebar";

// Layout for the authenticated app (dashboard, projects, settings):
// the sidebar shell. The public build-in-public page does NOT use this.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}
