import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";

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
    <header className="site-header app-header">
      <div className="app-header__inner">
        <Link className="app-wordmark" href="/" aria-label="India Food Ad Library home">
          <span className="app-wordmark__mark">IF</span>
          <span className="app-wordmark__copy">
            <strong>India Food Ad Library</strong>
            <small>Creative intelligence</small>
          </span>
        </Link>
        {onSearch ? (
          <label className="app-header__search">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
            <input aria-label="Search ads" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search the library" />
            <kbd>/</kbd>
          </label>
        ) : <span className="app-header__edition">India · Updated weekly</span>}
        <Link className="app-header__action" href={admin ? "/" : "/admin"}>{admin ? "Back to library" : "Review queue"}<ArrowUpRight aria-hidden="true" size={14} /></Link>
      </div>
    </header>
  );
}
