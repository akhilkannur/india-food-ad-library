import Link from "next/link";
import { ArrowUpRight, LogIn, LogOut, Search } from "lucide-react";

export function SiteHeader({
  search,
  onSearch,
  admin = false,
  authenticated = false,
  onAuthAction,
}: {
  search?: string;
  onSearch?: (value: string) => void;
  admin?: boolean;
  authenticated?: boolean;
  onAuthAction?: () => void;
}) {
  return (
    <header className="site-header app-header">
      <div className={`app-header__inner${onSearch ? " app-header__inner--library" : ""}`}>
        <Link className="app-wordmark" href="/" aria-label="India Food Ad Library home">
          <strong>India Food</strong>
          <span>Ad Library</span>
        </Link>
        {onSearch && (
          <nav className="app-header__nav" aria-label="Library views">
            <Link href="/#collections">Collections</Link>
            <Link href="/#all-ads">All ads</Link>
          </nav>
        )}
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
        {!admin && onAuthAction && (
          <button
            className="app-header__action"
            type="button"
            onClick={onAuthAction}
            aria-label={authenticated ? "Sign out" : "Join free"}
            title={authenticated ? "Sign out" : "Join free"}
          >
            {authenticated ? <LogOut aria-hidden="true" size={16} /> : <LogIn aria-hidden="true" size={16} />}
            <span className="app-header__action-label">{authenticated ? "Sign out" : "Join free"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
