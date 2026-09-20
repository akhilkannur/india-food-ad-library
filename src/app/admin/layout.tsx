import type { Metadata } from "next";
import "../globals.css";
import "../workbench.css";

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="library-app admin-app">{children}</div>;
}
