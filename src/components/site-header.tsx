import Link from "next/link";
import { ArrowUpRight, LogIn, LogOut } from "lucide-react";

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
    <header className="site-header app-header">
      <div className="app-header__inner">
        <div className="app-header__context">
          <Link className="app-wordmark" href="/" aria-label="India Food Ad Library home">
            <strong>India Food</strong>
            <span>Ad Library</span>
          </Link>
          <span className="app-header__separator" aria-hidden="true" />
          <span className="app-header__page-title">{admin ? "Review queue" : "Ad library"}</span>
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
              aria-label={authenticated ? "Sign out" : "Unlock the library"}
              title={authenticated ? "Sign out" : "Unlock the library"}
            >
              {authenticated ? <LogOut aria-hidden="true" size={16} /> : <LogIn aria-hidden="true" size={16} />}
              <span className="app-header__action-label">{authenticated ? "Sign out" : "Unlock the library"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
