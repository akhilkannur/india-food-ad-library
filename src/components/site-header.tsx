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
          <strong>India Food</strong>
          <span>Ad Library</span>
        </Link>
        {onSearch ? (
          <label className="app-header__search">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
            <input aria-label="Search ads" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search the library" />
            <kbd>/</kbd>
          </label>
        ) : <span className="app-header__edition">Creative research workspace</span>}
        {admin && (
          <Link className="app-header__action" href="/">
            Back to library<ArrowUpRight aria-hidden="true" size={14} />
          </Link>
        )}
      </div>
    </header>
  );
}
