import Link from "next/link";
import { ArrowUpRight, Library, LogIn, LogOut } from "lucide-react";

export function SiteHeader({
  admin = false,
  authenticated = false,
  onAuthAction,
}: {
  admin?: boolean;
  authenticated?: boolean;
  onAuthAction?: () => void;
}) {
  return (
    <header className={`site-header app-header${admin ? "" : " workspace-header"}`}>
      <div className="app-header__inner">
        <div className="app-header__context">
          <Link className="app-wordmark" href="/" aria-label="India Food Ad Library home">
            {!admin && <Library aria-hidden="true" size={20} />}
            <strong>India Food</strong>
            <span>Ad Library</span>
          </Link>
          {!admin && <span className="app-header__byline">by <a href="https://lisnagency.online" target="_blank" rel="noreferrer">LISN</a></span>}
          <span className="app-header__separator" aria-hidden="true" />
          <span className="app-header__page-title">{admin ? "Review queue" : "Ad library"}</span>
        </div>

        {!admin && <nav className="workspace-nav" aria-label="Library navigation">
          <Link href="/">Explore</Link>
          <Link href="/#collections">Formats</Link>
          <Link href="/#all-ads">All ads</Link>
        </nav>}

        <div className="app-header__actions">
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
              aria-label={authenticated ? "Sign out" : "Get full access for free"}
              title={authenticated ? "Sign out" : "Get full access for free"}
            >
              {authenticated ? <LogOut aria-hidden="true" size={16} /> : <LogIn aria-hidden="true" size={16} />}
              <span className="app-header__action-label">{authenticated ? "Sign out" : "Sign in"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
