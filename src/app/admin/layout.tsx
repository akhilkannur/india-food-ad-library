import "../globals.css";
import "../workbench.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="library-app admin-app">{children}</div>;
}
