"use client";

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
    <header className={`site-header app-header${admin ? "" : " workspace-header"}`}>
      <div className="app-header__inner">
        <div className="app-header__context">
          <Link className="app-wordmark" href="/" aria-label="India Food Ad Library home">
            <strong>India Food</strong>
            <span>Ad Library</span>
          </Link>
          <span className="app-header__separator" aria-hidden="true" />
          <span className="app-header__page-title">{admin ? "Review queue" : "Ad library"}</span>
        </div>

        {!admin && <nav className="workspace-nav" aria-label="Library navigation">
          <a href="https://lisnagency.online" target="_blank" rel="noreferrer">About LISN<ArrowUpRight size={13} aria-hidden="true" /></a>
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
              aria-label={authenticated ? "Sign out" : "Sign in for free"}
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
