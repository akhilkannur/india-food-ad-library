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
    <header className="site-header">
      <div className="site-header__inner shell">
        <Link className="wordmark" href="/">
          Food Ads <span className="wordmark__region">IND</span>
        </Link>
        {onSearch ? (
          <label className="header-search">
            <Search aria-hidden="true" size={17} strokeWidth={1.8} />
            <input
              aria-label="Search ads"
              type="search"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search brand, hook or category"
            />
            <kbd>/</kbd>
          </label>
        ) : (
          <span className="header-spacer" aria-hidden="true" />
        )}
        <Link className="header-action" href={admin ? "/" : "/admin"}>
          {admin ? "View library" : "Admin"}
          <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
        </Link>
      </div>
    </header>
  );
}
