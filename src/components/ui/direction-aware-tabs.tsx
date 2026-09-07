"use client";

import type { CSSProperties, ReactNode } from "react";

export type DirectionAwareTab = {
  id: string;
  label: ReactNode;
  content?: ReactNode;
};

export function DirectionAwareTabs({
  tabs,
  value,
  onValueChange,
  ariaLabel = "Tabs",
  className,
}: {
  tabs: DirectionAwareTab[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const activeIndex = Math.max(0, tabs.findIndex((tab) => tab.id === value));
  const activeTab = tabs[activeIndex];

  return (
    <div className={["direction-tabs", className].filter(Boolean).join(" ")}>
      <div
        className="direction-tabs__list"
        role="group"
        aria-label={ariaLabel}
        style={{ "--tabs-count": tabs.length, "--tab-index": activeIndex } as CSSProperties}
      >
        <span className="direction-tabs__active" aria-hidden="true" />
        {tabs.map((tab) => (
          <button
            aria-pressed={tab.id === value}
            key={tab.id}
            onClick={() => onValueChange(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab?.content ? <div className="direction-tabs__content">{activeTab.content}</div> : null}
    </div>
  );
}
