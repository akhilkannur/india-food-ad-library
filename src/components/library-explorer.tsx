"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { AdCard } from "@/components/ad-card";
import { AdDetailDialog } from "@/components/ad-detail-dialog";
import { AuthGateDialog } from "@/components/auth-gate-dialog";
import { FilterPanel } from "@/components/filter-panel";
import { ResultsToolbar, type ActiveFilter } from "@/components/results-toolbar";
import { SiteHeader } from "@/components/site-header";
import { diversifyByBrand, getCollectionAds, getCollectionDefinitions } from "@/lib/collections";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Ad } from "@/lib/types";

type SortOrder = "newest" | "oldest";
const AD_BATCH_SIZE = 36;
const FREE_AD_OPEN_LIMIT = 10;
const OPENED_ADS_KEY = "ifal-opened-ads";

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function getOpenedAdIds() {
  try {
    const value = JSON.parse(localStorage.getItem(OPENED_ADS_KEY) || "[]");
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function LibraryExplorer({
  ads,
  initialTotal,
  demoMode,
  showCollections = true,
  pageTitle,
  backLabel = "All collections",
}: {
  ads: Ad[];
  initialTotal?: number;
  demoMode: boolean;
  showCollections?: boolean;
  pageTitle?: string;
  backLabel?: string;
}) {
  const [loadedAds, setLoadedAds] = useState(ads);
  const [totalAds, setTotalAds] = useState(initialTotal ?? ads.length);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [format, setFormat] = useState("All");
  const [sellingAngle, setSellingAngle] = useState("All");
  const [language, setLanguage] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const filterDialogRef = useRef<HTMLDialogElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadedAdsRef = useRef(ads);
  const loadingMoreRef = useRef(false);
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set());
  const categories = useMemo(() => ["All", ...uniqueValues(loadedAds.map((ad) => ad.category))], [loadedAds]);
  const formats = useMemo(() => ["All", ...uniqueValues(loadedAds.map((ad) => ad.creative_style))], [loadedAds]);
  const sellingAngles = useMemo(() => ["All", ...uniqueValues(loadedAds.map((ad) => ad.selling_angle))], [loadedAds]);
  const languages = useMemo(() => ["All", ...uniqueValues(loadedAds.map((ad) => ad.language))], [loadedAds]);
  const brandCount = useMemo(() => new Set(loadedAds.map((ad) => ad.brand.id)).size, [loadedAds]);

  const visibleAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return diversifyByBrand(loadedAds
      .filter((ad) => !unavailableIds.has(ad.id))
      .filter((ad) => category === "All" || ad.category === category)
      .filter((ad) => format === "All" || ad.creative_style === format)
      .filter((ad) => sellingAngle === "All" || ad.selling_angle === sellingAngle)
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
      }));
  }, [loadedAds, category, format, sellingAngle, language, search, sortOrder, unavailableIds]);

  const activeFilterCount = [category, format, sellingAngle, language].filter((value) => value !== "All").length
    + (search.trim() ? 1 : 0);
  const resultCount = activeFilterCount === 0 ? totalAds : visibleAds.length;

  const renderedAds = visibleAds;

  useEffect(() => {
    loadedAdsRef.current = loadedAds;
  }, [loadedAds]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || loadedAdsRef.current.length >= totalAds) return;

    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const response = await fetch(`/api/ads?offset=${loadedAdsRef.current.length}&limit=${AD_BATCH_SIZE}`, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("The next page could not be loaded.");

      const page = await response.json() as { ads: Ad[]; total: number };
      setLoadedAds((current) => {
        const existing = new Set(current.map((ad) => ad.id));
        return [...current, ...page.ads.filter((ad) => !existing.has(ad.id))];
      });
      setTotalAds(page.total);
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "The next page could not be loaded.");
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [totalAds]);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (category !== "All") filters.push({ id: "category", label: category, onRemove: () => setCategory("All") });
    if (format !== "All") filters.push({ id: "format", label: format, onRemove: () => setFormat("All") });
    if (sellingAngle !== "All") filters.push({ id: "angle", label: sellingAngle, onRemove: () => setSellingAngle("All") });
    if (language !== "All") filters.push({ id: "language", label: language, onRemove: () => setLanguage("All") });
    if (search.trim()) filters.push({ id: "search", label: `“${search.trim()}”`, onRemove: () => setSearch("") });
    return filters;
  }, [category, format, sellingAngle, language, search]);

  const collections = useMemo(() => {
    return getCollectionDefinitions(visibleAds).map((definition) => {
      const matches = getCollectionAds(visibleAds, definition);
      const brands = new Set(matches.map((ad) => ad.brand.id));
      return { ...definition, ads: matches.slice(0, 6), brandCount: brands.size };
    }).filter((collection) => collection.ads.length >= 2);
  }, [visibleAds]);

  function clearFilters() {
    setSearch("");
    setCategory("All");
    setFormat("All");
    setSellingAngle("All");
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

  function openAd(ad: Ad) {
    if (authenticated) {
      setSelectedAd(ad);
      return;
    }

    const openedIds = getOpenedAdIds();
    if (!openedIds.includes(ad.id) && openedIds.length >= FREE_AD_OPEN_LIMIT) {
      setAuthOpen(true);
      return;
    }

    if (!openedIds.includes(ad.id)) {
      localStorage.setItem(OPENED_ADS_KEY, JSON.stringify([...openedIds, ad.id]));
    }
    setSelectedAd(ad);
  }

  async function signIn() {
    setAuthBusy(true);
    setAuthError(null);
    const { error } = await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setAuthError("Google sign-in could not start. Please try again.");
      setAuthBusy(false);
    }
  }

  async function authAction() {
    if (!authenticated) {
      setAuthOpen(true);
      return;
    }
    await supabaseBrowser.auth.signOut();
  }

  useEffect(() => {
    let active = true;
    supabaseBrowser.auth.getSession().then(({ data }) => {
      if (active) setAuthenticated(Boolean(data.session));
    });
    const { data } = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session));
      if (session) setAuthOpen(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

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

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || loadedAds.length >= totalAds) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) loadMore();
    }, { rootMargin: "600px 0px" });

    observer.observe(target);
    return () => observer.disconnect();
  }, [loadMore, loadedAds.length, totalAds]);

  return (
    <>
      <SiteHeader search={search} onSearch={setSearch} authenticated={authenticated} onAuthAction={authAction} />
      <main className="library-shell library-shell--collections">
        <div className="collection-main">
          {pageTitle && (
            <header className="collection-page-heading">
              <Link href="/">← {backLabel}</Link>
              <h1>{pageTitle}</h1>
              <p>{totalAds} creatives · {brandCount} brand{brandCount === 1 ? "" : "s"}</p>
            </header>
          )}

          {showCollections && collections.length > 0 && (
            <header className="library-intro">
              <div className="library-intro__copy">
                <h1>Find Indian food ads by format.</h1>
                <span>Search 1000s of ads from 100s of brands by product category, creative style, message angle, and language.</span>
              </div>
              <div className="library-intro__utility">
                <nav aria-label="Library sections">
                  <a href="#collections">Collections</a>
                  <a href="#all-ads">All ads</a>
                </nav>
              </div>
            </header>
          )}

          {showCollections && collections.length > 0 && (
            <section id="collections" className="collections-area" aria-label="Ad format collections">
              <div className="collections-heading">
                <h2>Collections</h2>
              </div>
              {collections.map((collection) => (
                <div className="collection-row" key={collection.name}>
                  <div className="collection-row__heading"><h3>{collection.name}</h3><span>{collection.ads.length} ads · {collection.brandCount} brands</span></div>
                  <div className="collection-row__cards">
                    {collection.ads.slice(0, 3).map((ad) => <AdCard ad={ad} key={ad.id} priority={false} onUnavailable={() => hideUnavailable(ad)} />)}
                  </div>
                  <Link className="collection-row__link" href={`/collections/${collection.slug}`} aria-label={`View ${collection.name} collection`} />
                </div>
              ))}
            </section>
          )}

        <div id="all-ads" className="library-layout">
          <aside className="library-sidebar" aria-label="Filter ads">
            <FilterPanel
              categories={categories}
              formats={formats}
              sellingAngles={sellingAngles}
              languages={languages}
              category={category}
              format={format}
              sellingAngle={sellingAngle}
              language={language}
              activeCount={activeFilterCount}
              resultCount={resultCount}
              onCategoryChange={setCategory}
              onFormatChange={setFormat}
              onSellingAngleChange={setSellingAngle}
              onLanguageChange={setLanguage}
              onClear={clearFilters}
            />
          </aside>

          <section className="library-results" aria-labelledby="library-title">
            <ResultsToolbar
              search={search}
              sortOrder={sortOrder}
              resultCount={resultCount}
              activeFilters={activeFilters}
              demoMode={demoMode}
              onSearchChange={setSearch}
              onSortChange={setSortOrder}
              onOpenFilters={() => setFiltersOpen(true)}
            />

            {visibleAds.length ? (
              <>
                <div className="ad-grid" aria-label="Approved ads">
                  {renderedAds.map((ad, index) => (
                    <AdCard
                      ad={ad}
                      key={ad.id}
                      priority={index < 4}
                      onOpen={() => openAd(ad)}
                      onUnavailable={() => hideUnavailable(ad)}
                    />
                  ))}
                </div>
                {loadedAds.length < totalAds && (
                  <div ref={loadMoreRef} className="load-more" aria-live="polite" aria-busy={isLoadingMore}>
                    {isLoadingMore ? "Loading more ads…" : loadMoreError ? (
                      <>
                        <span>{loadMoreError}</span>
                        <button type="button" className="load-more__button" onClick={loadMore}>Try again</button>
                      </>
                    ) : (
                      <span>Showing {loadedAds.length} of {totalAds} ads</span>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="library-empty">
                <Search aria-hidden="true" size={22} strokeWidth={1.6} />
                <h2>No matches in the loaded ads</h2>
                <p>Try another search or clear the active filters.</p>
                <button type="button" onClick={clearFilters}>Reset filters</button>
                {loadedAds.length < totalAds && (
                  <div ref={loadMoreRef} className="load-more load-more--empty" aria-live="polite" aria-busy={isLoadingMore}>
                    {isLoadingMore ? "Loading more ads…" : loadMoreError ? (
                      <>
                        <span>{loadMoreError}</span>
                        <button type="button" className="load-more__button" onClick={loadMore}>Try again</button>
                      </>
                    ) : (
                      <span>More ads load as you scroll…</span>
                    )}
                  </div>
                )}
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
            sellingAngles={sellingAngles}
            languages={languages}
            category={category}
            format={format}
            sellingAngle={sellingAngle}
            language={language}
            activeCount={activeFilterCount}
            resultCount={resultCount}
            onCategoryChange={setCategory}
            onFormatChange={setFormat}
            onSellingAngleChange={setSellingAngle}
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
      <AuthGateDialog
        open={authOpen}
        busy={authBusy}
        error={authError}
        onClose={() => setAuthOpen(false)}
        onSignIn={signIn}
      />
    </>
  );
}
