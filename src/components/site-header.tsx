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
      <div className="gallery-header shell">
        <Link className="gallery-brand" href="/">India Food Ad Library</Link>
        {onSearch ? (
          <label className="header-search">
            <Search aria-hidden="true" size={16} strokeWidth={1.8} />
            <input aria-label="Search ads" type="search" value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Search the library" />
            <kbd>/</kbd>
          </label>
        ) : <span />}
        <Link className="gallery-admin" href={admin ? "/" : "/admin"}>{admin ? "Library" : "Review"}<ArrowUpRight size={14} /></Link>
      </div>
    </header>
  );
}
