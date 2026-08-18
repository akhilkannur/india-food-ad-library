import Link from "next/link";
import { ArrowUpRight, Grid2X2, Info, Search, ShieldCheck } from "lucide-react";

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
      <aside className="site-rail">
        <Link className="wordmark" href="/" aria-label="India Food Ads home">
          <span className="wordmark__mark">IF</span>
          <span><strong>India Food</strong><small>Ad Library</small></span>
        </Link>
        <nav className="site-nav" aria-label="Primary navigation">
          <Link className="site-nav__item site-nav__item--active" href="/"><Grid2X2 size={16} /> Library</Link>
          <Link className="site-nav__item" href="/admin"><ShieldCheck size={16} /> Review queue</Link>
          <a className="site-nav__item" href="#about"><Info size={16} /> About the index</a>
        </nav>
        <div className="site-rail__footer">India · Meta creative<br /><span>Updated weekly</span></div>
      </aside>
      <div className="site-topbar">
        <div className="site-topbar__inner shell">
          <div className="topbar-context"><span>Workspace</span><strong>Creative index</strong></div>
          {onSearch ? (
            <label className="header-search">
              <Search aria-hidden="true" size={16} strokeWidth={1.8} />
              <input aria-label="Search ads" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search brands, hooks or formats" />
              <kbd>/</kbd>
            </label>
          ) : <span className="header-spacer" aria-hidden="true" />}
          <Link className="header-action" href={admin ? "/" : "/admin"}>
            {admin ? "View library" : "Admin"}<ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
          </Link>
        </div>
      </div>
    </header>
  );
}
