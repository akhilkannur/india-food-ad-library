import Link from "next/link";
import { ArrowUpRight, BookOpen, Search, ShieldCheck } from "lucide-react";

export function SiteHeader({
  search,
  onSearch,
  admin = false,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  admin?: boolean;
}) {
  return (
    <header className="site-header">
      <div className="gallery-header shell">
        <Link className="gallery-brand" href="/" aria-label="India Food Ad Library home">
          <span className="gallery-brand__mark">IF</span>
          <span>India Food Ad Library</span>
        </Link>
        <nav className="site-header__nav" aria-label="Primary navigation">
          <Link className="site-header__nav-link site-header__nav-link--active" href="/"><BookOpen size={15} /> Library</Link>
          <Link className="site-header__nav-link" href="/admin"><ShieldCheck size={15} /> Review</Link>
        </nav>
        {onSearch ? (
          <label className="header-search">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
            <input aria-label="Search ads" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search the library" />
            <kbd>/</kbd>
          </label>
        ) : <span />}
        <Link className="gallery-admin" href={admin ? "/" : "/admin"}>{admin ? "Back to library" : "Open review queue"}<ArrowUpRight size={14} /></Link>
      </div>
    </header>
  );
}
