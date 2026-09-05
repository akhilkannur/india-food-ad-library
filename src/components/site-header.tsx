import Link from "next/link";
import { ArrowUpRight, LogIn, LogOut } from "lucide-react";

export function SiteHeader({
  admin = false,
  authenticated = false,
  adCount,
  onAuthAction,
}: {
  admin?: boolean;
  authenticated?: boolean;
  adCount?: number;
  onAuthAction?: () => void;
}) {
  return (
    <header className="site-header app-header">
      <div className="app-header__inner">
        <div className="app-header__context">
          <Link className="app-wordmark" href="/" aria-label="India Food Ad Library home">
            <strong>India Food</strong>
            <span>Ad Library</span>
          </Link>
          {!admin && <span className="app-header__byline">by <a href="https://lisnagency.online" target="_blank" rel="noreferrer">LISN</a></span>}
          <span className="app-header__separator" aria-hidden="true" />
          <span className="app-header__page-title">{admin ? "Review queue" : "Ad library"}</span>
          {!admin && typeof adCount === "number" && <span className="app-header__count">{adCount.toLocaleString()} ads</span>}
        </div>

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
              <span className="app-header__action-label">{authenticated ? "Sign out" : "Get full access — free"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
