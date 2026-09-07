"use client";

import Link from "next/link";
import { ArrowUpRight, LogIn, LogOut } from "lucide-react";
import FluidOrb from "@/components/fluid-orb";
import { BorderBeamButton } from "@/components/ui/border-beam-button";
import TextAnimate from "@/components/ui/text-animate";

export function SiteHeader({
  admin = false,
  authenticated = false,
  showFluidOrb = false,
  onAuthAction,
}: {
  admin?: boolean;
  authenticated?: boolean;
  showFluidOrb?: boolean;
  onAuthAction?: () => void;
}) {
  return (
    <header className={`site-header app-header${admin ? "" : " workspace-header"}`}>
      <div className="app-header__inner">
        <div className="app-header__context">
          <Link className={`app-wordmark${showFluidOrb ? " app-wordmark--with-orb" : ""}`} href="/" aria-label="F&B Ad Library home">
            {showFluidOrb && <FluidOrb className="app-wordmark__orb" size={44} color="#ff765d" aria-hidden="true" />}
            {showFluidOrb ? (
              <strong><TextAnimate text="F&B Ad Library" type="calmInUp" /></strong>
            ) : (
              <strong>F&amp;B Ad Library</strong>
            )}
            <span>1000s of ads by 100s of brands. updated weekly</span>
          </Link>
          <span className="app-header__separator" aria-hidden="true" />
          <span className="app-header__page-title">{admin ? "Review queue" : "Ad library"}</span>
        </div>

        {!admin && <nav className="workspace-nav" aria-label="Library navigation">
          <a href="https://lisnagency.online" target="_blank" rel="noreferrer">
            Made with <span className="workspace-nav__heart" aria-label="love" role="img">♥</span> by LISN
          </a>
        </nav>}

        <div className="app-header__actions">
          {admin && (
            <Link className="app-header__action" href="/">
              Back to library<ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          )}
          {!admin && onAuthAction && authenticated && (
            <button
              className="app-header__action"
              type="button"
              onClick={onAuthAction}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut aria-hidden="true" size={16} />
              <span className="app-header__action-label">Sign out</span>
            </button>
          )}
          {!admin && onAuthAction && !authenticated && (
            <BorderBeamButton
              aria-label="Sign in for free"
              beamSize="sm"
              className="app-header__action"
              colorVariant="sunset"
              onClick={onAuthAction}
              title="Get full access for free"
              type="button"
              variant="default"
            >
              <LogIn aria-hidden="true" size={16} />
              <span className="app-header__action-label">Sign in</span>
            </BorderBeamButton>
          )}
        </div>
      </div>
    </header>
  );
}
