"use client";

import type { ReactNode } from "react";

export function SidePanel({
  panelOpen,
  handlePanelOpen,
  renderButton,
  children,
  className,
}: {
  panelOpen: boolean;
  handlePanelOpen: () => void;
  renderButton?: (handleToggle: () => void) => ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={["side-panel", className].filter(Boolean).join(" ")}
      data-open={panelOpen}
      data-slot="side-panel"
    >
      {renderButton ? <div className="side-panel__trigger">{renderButton(handlePanelOpen)}</div> : null}
      <div className="side-panel__surface">{children}</div>
    </div>
  );
}
