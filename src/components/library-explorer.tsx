"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react";
import { AdDetailDialog } from "@/components/ad-detail-dialog";
import { CreativePreview } from "@/components/creative-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Ad } from "@/lib/types";

type SortOrder = "newest" | "oldest";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function LibraryExplorer({ ads, demoMode }: { ads: Ad[]; demoMode: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [format, setFormat] = useState("All");
  const [funnelStage, setFunnelStage] = useState("All");
  const [language, setLanguage] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
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
        document.querySelector<HTMLInputElement>(".library-search__input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <SiteHeader />
      <main className="library-page">
        <section className="library-intro" aria-labelledby="library-title">
          <div className="library-intro__copy">
            <p className="library-kicker">India · Food &amp; beverage · Meta ads</p>
            <h1 id="library-title">Find the ad. Understand the play.</h1>
            <p>Browse approved creatives, then inspect the hook, format, message angle, funnel stage, and source.</p>
          </div>
          <dl className="library-stats" aria-label="Library coverage">
            <div><dt>Approved ads</dt><dd>{ads.length}</dd></div>
            <div><dt>Brands</dt><dd>{brandCount}</dd></div>
            <div><dt>Platform</dt><dd>Meta</dd></div>
          </dl>
        </section>

        <section className="library-workbench" aria-label="Search and filter ads">
          <label className="library-search">
            <span>Search creatives</span>
            <span className="library-search__control">
              <Search aria-hidden="true" size={18} strokeWidth={1.8} />
              <input
                className="library-search__input"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Brand, hook, headline, angle…"
              />
              <kbd>/</kbd>
            </span>
          </label>

          <div className="library-categories" aria-label="Filter by category">
            <span className="library-filter-label"><SlidersHorizontal aria-hidden="true" size={15} /> Category</span>
            <div className="library-category-list">
              {categories.map((item) => (
                <button
                  className="library-category"
                  type="button"
                  key={item}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="library-selects">
            <FilterSelect label="Creative format" value={format} values={formats} onChange={setFormat} />
            <FilterSelect label="Funnel stage" value={funnelStage} values={funnelStages} onChange={setFunnelStage} />
            <FilterSelect label="Language" value={language} values={languages} onChange={setLanguage} />
            <FilterSelect
              label="Sort"
              value={sortOrder}
              values={["newest", "oldest"]}
              labels={{ newest: "Newest first", oldest: "Oldest first" }}
              onChange={(value) => setSortOrder(value as SortOrder)}
            />
          </div>
        </section>

        <div className="library-results" aria-live="polite">
          <div>
            <strong>{visibleAds.length} creative{visibleAds.length === 1 ? "" : "s"}</strong>
            <span>{activeFilterCount ? ` · ${activeFilterCount} active filter${activeFilterCount === 1 ? "" : "s"}` : " · all approved ads"}</span>
          </div>
          {demoMode && <span className="library-results__note">Sample records · connect Supabase for live data</span>}
          {activeFilterCount > 0 && (
            <button className="library-clear" type="button" onClick={clearFilters}>
              <X aria-hidden="true" size={15} /> Clear filters
            </button>
          )}
        </div>

        {visibleAds.length ? (
          <section className="creative-grid" aria-label="Approved ads">
            {visibleAds.map((ad, index) => (
              <article className="creative-card" key={ad.id}>
                <div className="creative-card__media">
                  <CreativePreview ad={ad} compact priority={index < 4} onUnavailable={() => hideUnavailable(ad)} />
                </div>
                <div className="creative-card__body">
                  <div className="creative-card__brand-row">
                    <span className="creative-card__brand-mark" aria-hidden="true">{ad.brand.name.charAt(0)}</span>
                    <strong>{ad.brand.name}</strong>
                    <time dateTime={ad.first_seen_at}>{formatDate(ad.first_seen_at)}</time>
                  </div>
                  <h2 className="creative-card__headline">{ad.headline || "No headline captured"}</h2>
                  <div className="creative-card__tags">
                    <span>{ad.creative_style || ad.format}</span>
                    {ad.selling_angle && <span>{ad.selling_angle}</span>}
                    {ad.funnel_stage && <span>{ad.funnel_stage}</span>}
                  </div>
                  <span className="creative-card__action">Inspect ad <ArrowUpRight aria-hidden="true" size={15} /></span>
                </div>
                <button
                  className="creative-card__trigger"
                  type="button"
                  onClick={() => setSelectedAd(ad)}
                  aria-label={`Inspect ${ad.brand.name} creative: ${ad.headline || ad.format}`}
                />
              </article>
            ))}
          </section>
        ) : (
          <section className="library-empty">
            <Search aria-hidden="true" size={24} strokeWidth={1.6} />
            <h2>No creatives match these filters.</h2>
            <p>Try a broader search, or reset the active filters.</p>
            <button className="button" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </section>
        )}
      </main>
      <SiteFooter />
      <AdDetailDialog
        ad={selectedAd}
        onClose={() => setSelectedAd(null)}
        onUnavailable={() => selectedAd && hideUnavailable(selectedAd)}
      />
    </>
  );
}

function FilterSelect({
  label,
  value,
  values,
  labels,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  labels?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="library-select">
      <span>{label}</span>
      <span className="library-select__control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {values.map((item) => <option key={item} value={item}>{labels?.[item] || item}</option>)}
        </select>
        <ChevronDown aria-hidden="true" size={14} />
      </span>
    </label>
  );
}
