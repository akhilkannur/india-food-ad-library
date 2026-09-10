"use client";

import { ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { DirectionAwareTabs } from "@/components/ui/direction-aware-tabs";
import type { MediaFilter } from "@/lib/media";

const MEDIA_TABS = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Images" },
];

export type ActiveFilter = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function ResultsToolbar({
  search,
  mediaFilter,
  onMediaFilterChange,
  sortOrder,
  activeFilters,
  demoMode,
  onSearchChange,
  onSortChange,
  onOpenFilters,
  onClearAll,
}: {
  search: string;
  mediaFilter: MediaFilter;
  onMediaFilterChange: (value: MediaFilter) => void;
  sortOrder: "newest" | "oldest";
  resultCount: number;
  activeFilters: ActiveFilter[];
  demoMode: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: "newest" | "oldest") => void;
  onOpenFilters: () => void;
  onClearAll?: () => void;
}) {
  return (
    <div className="results-toolbar" role="search" aria-label="Search and filter ads">
      <div className="results-toolbar__row">
        <DirectionAwareTabs
          ariaLabel="Media type"
          className="media-toggle"
          tabs={MEDIA_TABS}
          value={mediaFilter}
          onValueChange={(value) => onMediaFilterChange(value as MediaFilter)}
        />
        <label className="results-search">
          <Search aria-hidden="true" size={17} strokeWidth={1.8} />
          <input
            className="library-search-input"
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search ads"
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
          <select aria-label="Sort ads" value={sortOrder} onChange={(event) => onSortChange(event.target.value as "newest" | "oldest")}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <ChevronDown aria-hidden="true" size={14} />
        </label>
      </div>

      <div className="results-toolbar__summary" aria-live="polite">
        {demoMode && <span className="data-note">Sample data</span>}
        {activeFilters.length > 0 && (
          <div className="active-filters" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button type="button" key={filter.id} onClick={filter.onRemove}>
                {filter.label}<X aria-hidden="true" size={13} />
              </button>
            ))}
            {activeFilters.length > 1 && onClearAll && (
              <button type="button" className="active-filters__clear-all" onClick={onClearAll}>
                Clear all
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
