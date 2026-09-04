"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { AdCard } from "@/components/ad-card";
import { AdDetailDialog } from "@/components/ad-detail-dialog";
import { FilterPanel } from "@/components/filter-panel";
import { ResultsToolbar, type ActiveFilter } from "@/components/results-toolbar";
import { SiteHeader } from "@/components/site-header";
import type { Ad } from "@/lib/types";

type SortOrder = "newest" | "oldest";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

export function LibraryExplorer({ ads, demoMode }: { ads: Ad[]; demoMode: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [format, setFormat] = useState("All");
  const [funnelStage, setFunnelStage] = useState("All");
  const [language, setLanguage] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const categories = useMemo(() => ["All", ...uniqueValues(ads.map((ad) => ad.category))], [ads]);
  const formats = useMemo(() => ["All", ...uniqueValues(ads.map((ad) => ad.creative_style || ad.format))], [ads]);
  const funnelStages = useMemo(() => ["All", ...uniqueValues(ads.map((ad) => ad.funnel_stage))], [ads]);
  const languages = useMemo(() => ["All", ...uniqueValues(ads.map((ad) => ad.language))], [ads]);
  const brandCount = useMemo(() => new Set(ads.map((ad) => ad.brand.id)).size, [ads]);

  const visibleAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ads
      .filter((ad) => !unavailableIds.has(ad.id))
      .filter((ad) => category === "All" || ad.category === category)
      .filter((ad) => format === "All" || (ad.creative_style || ad.format) === format)
      .filter((ad) => funnelStage === "All" || ad.funnel_stage === funnelStage)
      .filter((ad) => language === "All" || ad.language === language)
      .filter((ad) => {
        if (!query) return true;
        return [ad.brand.name, ad.category, ad.format, ad.creative_style, ad.selling_angle, ad.hook, ad.headline, ad.language]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const delta = new Date(right.first_seen_at).getTime() - new Date(left.first_seen_at).getTime();
        return sortOrder === "newest" ? delta : -delta;
      });
  }, [ads, category, format, funnelStage, language, search, sortOrder, unavailableIds]);

  const activeFilterCount = [category, format, funnelStage, language].filter((value) => value !== "All").length
    + (search.trim() ? 1 : 0);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (category !== "All") filters.push({ id: "category", label: category, onRemove: () => setCategory("All") });
    if (format !== "All") filters.push({ id: "format", label: format, onRemove: () => setFormat("All") });
    if (funnelStage !== "All") filters.push({ id: "funnel", label: funnelStage, onRemove: () => setFunnelStage("All") });
    if (language !== "All") filters.push({ id: "language", label: language, onRemove: () => setLanguage("All") });
    if (search.trim()) filters.push({ id: "search", label: `“${search.trim()}”`, onRemove: () => setSearch("") });
    return filters;
  }, [category, format, funnelStage, language, search]);

  const collections = useMemo(() => {
    const definitions = [
      { name: "Ingredient-led", match: (ad: Ad) => /ingredient/i.test(`${ad.hook} ${ad.selling_angle} ${ad.headline}`) },
      { name: "Founder-led stories", match: (ad: Ad) => /founder|origin|story/i.test(`${ad.format} ${ad.hook} ${ad.selling_angle}`) },
      { name: "Offers & bundles", match: (ad: Ad) => /offer|discount|value|bundle/i.test(`${ad.format} ${ad.selling_angle} ${ad.offer} ${ad.headline}`) },
      { name: "Hindi & Hinglish", match: (ad: Ad) => /hindi|hinglish/i.test(ad.language || "") },
    ];
    return definitions.map((definition) => {
      const matches = visibleAds.filter(definition.match);
      const brands = new Set(matches.map((ad) => ad.brand.id));
      return { name: definition.name, ads: matches.slice(0, 8), brandCount: brands.size };
    }).filter((collection) => collection.ads.length >= 4 && collection.brandCount >= 3);
  }, [visibleAds]);

  function clearFilters() {
    setSearch("");
    setCategory("All");
    setFormat("All");
    setFunnelStage("All");
    setLanguage("All");
  }

  function hideUnavailable(ad: Ad) {
    setUnavailableIds((ids) => {
      const next = new Set(ids);
      next.add(ad.id);
      return next;
    });
    if (selectedAd?.id === ad.id) setSelectedAd(null);
  }

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".library-search-input")?.focus();
      }
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const dialog = filterDialogRef.current;
    if (!dialog) return;
    if (filtersOpen && !dialog.open) dialog.showModal();
    if (!filtersOpen && dialog.open) dialog.close();
  }, [filtersOpen]);

  return (
    <>
      <SiteHeader />
      <main className="library-shell library-shell--collections">
        <aside className="collection-rail" aria-label="Library sections">
          <div className="collection-rail__brand">IF<span>/</span>AL</div>
          <nav>
            <a className="is-active" href="#featured">Featured</a>
            <a href="#collections">Collections</a>
            <a href="#all-ads">All ads</a>
          </nav>
          <div className="collection-rail__bottom">
            <a href="/admin">Review queue ↗</a>
            <span>{brandCount} brands indexed</span>
          </div>
        </aside>

        <div className="collection-main">
          <header className="collection-topline">
            <div><span className="collection-topline__dot" /> India Food Ad Library</div>
            <div className="collection-topline__meta">{ads.length} approved creatives <span>·</span> India</div>
          </header>

          <section id="collections" className="collections-area" aria-label="Curated collections">
            <div className="collections-heading"><h2>Patterns worth saving</h2><span>Cross-brand collections</span></div>
            {collections.map((collection, index) => (
              <div className="collection-row" key={collection.name}>
                <div className="collection-row__heading"><h3>{collection.name}</h3><span>{String(index + 1).padStart(2, "0")} / {collection.ads.length} ads · {collection.brandCount} brands</span></div>
                <div className="collection-row__cards">
                  {collection.ads.map((ad) => <AdCard ad={ad} key={ad.id} priority={false} onOpen={() => setSelectedAd(ad)} onUnavailable={() => hideUnavailable(ad)} />)}
                </div>
              </div>
            ))}
          </section>

        <div id="all-ads" className="library-layout">
          <aside className="library-sidebar" aria-label="Filter ads">
            <FilterPanel
              categories={categories}
              formats={formats}
              funnelStages={funnelStages}
              languages={languages}
              category={category}
              format={format}
              funnelStage={funnelStage}
              language={language}
              activeCount={activeFilterCount}
              resultCount={visibleAds.length}
              onCategoryChange={setCategory}
              onFormatChange={setFormat}
              onFunnelStageChange={setFunnelStage}
              onLanguageChange={setLanguage}
              onClear={clearFilters}
            />
          </aside>

          <section className="library-results" aria-labelledby="library-title">
            <ResultsToolbar
              search={search}
              sortOrder={sortOrder}
              resultCount={visibleAds.length}
              activeFilters={activeFilters}
              demoMode={demoMode}
              onSearchChange={setSearch}
              onSortChange={setSortOrder}
              onOpenFilters={() => setFiltersOpen(true)}
            />

            {visibleAds.length ? (
              <div className="ad-grid" aria-label="Approved ads">
                {visibleAds.map((ad, index) => (
                  <AdCard
                    ad={ad}
                    key={ad.id}
                    priority={index < 4}
                    onOpen={() => setSelectedAd(ad)}
                    onUnavailable={() => hideUnavailable(ad)}
                  />
                ))}
              </div>
            ) : (
              <div className="library-empty">
                <Search aria-hidden="true" size={22} strokeWidth={1.6} />
                <h2>No matching ads</h2>
                <p>Try another search or clear the active filters.</p>
                <button type="button" onClick={clearFilters}>Reset filters</button>
              </div>
            )}
          </section>
        </div>
        </div>
      </main>

      <dialog
        ref={filterDialogRef}
        className="filter-drawer"
        aria-label="Filter ads"
        onClose={() => setFiltersOpen(false)}
        onClick={(event) => {
          if (event.target === filterDialogRef.current) setFiltersOpen(false);
        }}
      >
        <div className="filter-drawer__sheet">
          <FilterPanel
            mobile
            categories={categories}
            formats={formats}
            funnelStages={funnelStages}
            languages={languages}
            category={category}
            format={format}
            funnelStage={funnelStage}
            language={language}
            activeCount={activeFilterCount}
            resultCount={visibleAds.length}
            onCategoryChange={setCategory}
            onFormatChange={setFormat}
            onFunnelStageChange={setFunnelStage}
            onLanguageChange={setLanguage}
            onClear={clearFilters}
            onClose={() => setFiltersOpen(false)}
          />
        </div>
      </dialog>
      <AdDetailDialog
        ad={selectedAd}
        onClose={() => setSelectedAd(null)}
        onUnavailable={() => selectedAd && hideUnavailable(selectedAd)}
      />
    </>
  );
}
