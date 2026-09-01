"use client";

import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import type { Ad, Brand } from "@/lib/types";

type BrandWithCount = Brand & { adCount: number };

export function BrandDirectory({
  brands,
  ads,
  demoMode,
}: {
  brands: BrandWithCount[];
  ads: Ad[];
  demoMode: boolean;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q),
    );
  }, [brands, search]);

  const totalAds = ads.length;
  const totalBrands = brands.length;
  const categories = useMemo(
    () => Array.from(new Set(brands.map((b) => b.category))).sort(),
    [brands],
  );

  return (
    <>
      <header className="dir-header">
        <div className="dir-header__inner shell">
          <Link className="dir-brand" href="/" aria-label="Home">
            <span className="dir-brand__mark">IF</span>
            <span className="dir-brand__text">
              <strong>India Food Ad Library</strong>
              <small>Creative Index</small>
            </span>
          </Link>
          <label className="dir-search">
            <Search aria-hidden="true" size={15} strokeWidth={1.8} />
            <input
              aria-label="Search brands"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands"
            />
          </label>
          <Link className="dir-admin-link" href="/admin">
            Review queue <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      <main className="dir-main shell">
        <section className="dir-hero">
          <div className="dir-hero__copy">
            <p className="dir-hero__eyebrow">Creative Intelligence</p>
            <h1 className="dir-hero__heading">
              What India&apos;s food brands are running
            </h1>
            <p className="dir-hero__description">
              A research library of ad creatives from Indian food and beverage
              brands. Browse hooks, formats, angles, and copy strategies across
              the category.
            </p>
          </div>
          <div className="dir-hero__stats">
            <div>
              <strong>{totalBrands}</strong>
              <span>Brands tracked</span>
            </div>
            <div>
              <strong>{totalAds}</strong>
              <span>Creatives indexed</span>
            </div>
            <div>
              <strong>{categories.length}</strong>
              <span>Categories</span>
            </div>
          </div>
        </section>

        <section className="dir-results">
          <span className="dir-results__title">Brand Directory</span>
          <span>{filtered.length} brands</span>
          {demoMode && <span className="dir-results__demo">Demo data</span>}
        </section>

        <section className="dir-grid" aria-label="Brand directory">
          {filtered.map((brand) => (
            <Link
              className="dir-card"
              key={brand.id}
              href={`/brand/${brand.slug}`}
            >
              <div className="dir-card__top">
                <span className="dir-card__mark">
                  {brand.name.charAt(0)}
                </span>
                <span className="dir-card__count">
                  {brand.adCount} creative{brand.adCount !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="dir-card__body">
                <h2 className="dir-card__name">{brand.name}</h2>
                <span className="dir-card__category">{brand.category}</span>
              </div>
              <span className="dir-card__arrow">
                <ArrowUpRight size={16} />
              </span>
            </Link>
          ))}
        </section>

        {filtered.length === 0 && (
          <section className="dir-empty">
            <h2>No brands match &ldquo;{search}&rdquo;</h2>
            <p>Try a different search term.</p>
            <button
              className="dir-btn"
              type="button"
              onClick={() => setSearch("")}
            >
              Clear search
            </button>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
