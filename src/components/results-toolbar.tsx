"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";

export type ActiveFilter = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function ResultsToolbar({
  search,
  sortOrder,
  resultCount,
  activeFilters,
  demoMode,
  onSearchChange,
  onSortChange,
  onOpenFilters,
}: {
  search: string;
  sortOrder: "newest" | "oldest";
  resultCount: number;
  activeFilters: ActiveFilter[];
  demoMode: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: "newest" | "oldest") => void;
  onOpenFilters: () => void;
}) {
  return (
    <div className="results-toolbar">
      <div className="results-toolbar__row">
        <label className="results-search">
          <Search aria-hidden="true" size={17} strokeWidth={1.8} />
          <input
            className="library-search-input"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search brands, formats, hooks…"
            aria-label="Search ads"
          />
          <kbd>/</kbd>
        </label>

        <button className="mobile-filter-button" type="button" onClick={onOpenFilters}>
          <SlidersHorizontal aria-hidden="true" size={16} /> Filters
          {activeFilters.length > 0 && <span>{activeFilters.length}</span>}
        </button>

        <label className="sort-control">
          <span>Sort</span>
          <select value={sortOrder} onChange={(event) => onSortChange(event.target.value as "newest" | "oldest")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </label>
      </div>

      <div className="results-toolbar__summary" aria-live="polite">
        <p><strong>{resultCount}</strong> creative{resultCount === 1 ? "" : "s"}</p>
        {demoMode && <span className="data-note">Sample data</span>}
        {activeFilters.length > 0 && (
          <div className="active-filters" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button type="button" key={filter.id} onClick={filter.onRemove}>
                {filter.label}<X aria-hidden="true" size={13} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
