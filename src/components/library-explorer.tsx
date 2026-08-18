"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { AdDetailDialog } from "@/components/ad-detail-dialog";
import { CreativePreview } from "@/components/creative-preview";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { Ad } from "@/lib/types";

type SortOrder = "newest" | "oldest";

export function LibraryExplorer({ ads, demoMode }: { ads: Ad[]; demoMode: boolean }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const categories = useMemo(
    () => ["All", ...Array.from(new Set(ads.map((ad) => ad.category))).sort()],
    [ads],
  );

  const visibleAds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return ads
      .filter((ad) => category === "All" || ad.category === category)
      .filter((ad) => {
        if (!query) return true;
        return [ad.brand.name, ad.category, ad.format, ad.hook, ad.headline, ad.language]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const delta = new Date(right.first_seen_at).getTime() - new Date(left.first_seen_at).getTime();
        return sortOrder === "newest" ? delta : -delta;
      });
  }, [ads, category, search, sortOrder]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "/" && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".header-search input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <SiteHeader search={search} onSearch={setSearch} />
      <main className="shell">
        <section className="page-intro">
          <h1 className="page-intro__heading">Indian food ads, chosen with intent.</h1>
          <div className="page-intro__meta">
            <p className="page-intro__description">
              Browse approved creative by category, format and hook. Every record is reviewed before it appears here.
            </p>
            <p className="dataset-note">
              {visibleAds.length} {demoMode ? "demo" : "approved"} {visibleAds.length === 1 ? "ad" : "ads"}
            </p>
          </div>
        </section>

        <section className="filter-band" aria-label="Filter ads">
          <div className="filter-band__inner">
            <div className="filter-scroll">
              {categories.map((item) => (
                <button
                  className="filter-chip"
                  type="button"
                  key={item}
                  aria-pressed={category === item}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            <select
              className="sort-select"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              aria-label="Sort ads"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
        </section>

        <div className="result-line" aria-live="polite">
          <span>{visibleAds.length} results</span>
          {demoMode && <span>Sample records · connect Supabase for live data</span>}
        </div>

        {visibleAds.length ? (
          <section className="ad-grid" aria-label="Approved ads">
            {visibleAds.map((ad) => (
              <article className="ad-card" key={ad.id}>
                <button className="ad-card__button" type="button" onClick={() => setSelectedAd(ad)}>
                  <CreativePreview ad={ad} />
                  <span className="icon-button card-action" aria-hidden="true">
                    <ArrowUpRight size={17} strokeWidth={1.8} />
                  </span>
                </button>
                <div className="ad-card__meta">
                  <h2 className="ad-card__brand">{ad.brand.name}</h2>
                  <span className="ad-card__date">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(ad.first_seen_at))}</span>
                  <p className="ad-card__tags">{ad.format} · {ad.hook || "Unclassified"} · {ad.language}</p>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <h2>No ads match this filter.</h2>
            <p>Clear the search or choose another category.</p>
            <button className="button" type="button" onClick={() => { setSearch(""); setCategory("All"); }}>
              Clear filters
            </button>
          </section>
        )}
      </main>
      <SiteFooter />
      <AdDetailDialog ad={selectedAd} onClose={() => setSelectedAd(null)} />
    </>
  );
}
