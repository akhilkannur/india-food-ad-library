"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ArrowLeft,
  BarChart3,
  Copy,
  FileText,
  Filter,
  Headline,
  Image as ImageIcon,
  Target,
  X,
} from "lucide-react";
import { CreativePreview } from "@/components/creative-preview";
import { SiteFooter } from "@/components/site-footer";
import type { Ad, Brand } from "@/lib/types";

type Tab = "creatives" | "hooks" | "copy" | "headlines" | "formats" | "angles";

const tabs: { value: Tab; label: string; icon: typeof BarChart3 }[] = [
  { value: "creatives", label: "Creatives", icon: ImageIcon },
  { value: "hooks", label: "Hooks", icon: Headline },
  { value: "copy", label: "Ad copy", icon: Copy },
  { value: "headlines", label: "Headlines", icon: FileText },
  { value: "formats", label: "Formats", icon: BarChart3 },
  { value: "angles", label: "Angles", icon: Target },
];

type FilterState = {
  format: string;
  hook: string;
  funnel_stage: string;
  creative_style: string;
};

const emptyFilters: FilterState = {
  format: "All",
  hook: "All",
  funnel_stage: "All",
  creative_style: "All",
};

function countBy(ads: Ad[], key: keyof Ad) {
  const map = new Map<string, number>();
  for (const ad of ads) {
    const val = ad[key];
    const label = typeof val === "string" && val ? val : "Untagged";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map, ([label, count]) => ({ label, count })).sort(
    (a, b) => b.count - a.count,
  );
}

export function BrandPageView({
  brand,
  ads,
  demoMode,
}: {
  brand: Brand;
  ads: Ad[];
  demoMode: boolean;
}) {
  const [tab, setTab] = useState<Tab>("creatives");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);

  const filterOptions = useMemo(() => {
    const unique = (key: keyof Ad) =>
      Array.from(new Set(ads.map((ad) => ad[key]).filter(Boolean) as string[])).sort();
    return {
      formats: unique("format"),
      hooks: unique("hook"),
      funnelStages: unique("funnel_stage"),
      creativeStyles: unique("creative_style"),
    };
  }, [ads]);

  const filteredAds = useMemo(() => {
    return ads.filter(
      (ad) =>
        (filters.format === "All" || ad.format === filters.format) &&
        (filters.hook === "All" || ad.hook === filters.hook) &&
        (filters.funnel_stage === "All" || ad.funnel_stage === filters.funnel_stage) &&
        (filters.creative_style === "All" || ad.creative_style === filters.creative_style),
    );
  }, [ads, filters]);

  const insights = useMemo(() => {
    const byHook = countBy(filteredAds, "hook");
    const byFormat = countBy(filteredAds, "format");
    const byFunnel = countBy(filteredAds, "funnel_stage");
    const byStyle = countBy(filteredAds, "creative_style");
    const byAngle = countBy(filteredAds, "selling_angle");
    const byLang = countBy(filteredAds, "language");
    return { byHook, byFormat, byFunnel, byStyle, byAngle, byLang };
  }, [filteredAds]);

  const activeFilterCount = Object.values(filters).filter(
    (v) => v !== "All",
  ).length;

  function clearFilters() {
    setFilters(emptyFilters);
  }

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
          <nav className="dir-nav" aria-label="Brand navigation">
            <Link className="dir-nav__link" href="/">
              <ArrowLeft size={14} /> All brands
            </Link>
          </nav>
          <Link className="dir-admin-link" href="/admin">
            Review queue <ArrowUpRight size={13} />
          </Link>
        </div>
      </header>

      <main className="dir-main shell">
        <section className="brand-hero">
          <div className="brand-hero__copy">
            <p className="brand-hero__eyebrow">{brand.category}</p>
            <h1 className="brand-hero__heading">{brand.name}</h1>
            <p className="brand-hero__meta">
              {ads.length} creative{ads.length !== 1 ? "s" : ""} indexed
              {demoMode && <span className="brand-hero__demo"> · Demo data</span>}
            </p>
          </div>
          <div className="brand-hero__stats">
            <div>
              <strong>{insights.byHook.length}</strong>
              <span>Hooks used</span>
            </div>
            <div>
              <strong>{insights.byFormat.length}</strong>
              <span>Formats</span>
            </div>
            <div>
              <strong>{insights.byAngle.length}</strong>
              <span>Angles</span>
            </div>
          </div>
        </section>

        <div className="brand-tabs" role="tablist" aria-label="Brand analysis">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                className="brand-tab"
                key={t.value}
                role="tab"
                aria-selected={tab === t.value}
                onClick={() => setTab(t.value)}
                type="button"
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {(tab === "creatives" || tab === "headlines") && (
          <div className="brand-filters">
            <div className="brand-filters__label">
              <Filter size={14} /> Filter
              {activeFilterCount > 0 && (
                <button
                  className="brand-filters__clear"
                  onClick={clearFilters}
                  type="button"
                >
                  <X size={12} /> Clear ({activeFilterCount})
                </button>
              )}
            </div>
            <div className="brand-filters__scroll">
              <select
                className="brand-filter-select"
                value={filters.format}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, format: e.target.value }))
                }
              >
                <option value="All">Format</option>
                {filterOptions.formats.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                className="brand-filter-select"
                value={filters.hook}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, hook: e.target.value }))
                }
              >
                <option value="All">Hook</option>
                {filterOptions.hooks.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
              <select
                className="brand-filter-select"
                value={filters.funnel_stage}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, funnel_stage: e.target.value }))
                }
              >
                <option value="All">Funnel</option>
                {filterOptions.funnelStages.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <select
                className="brand-filter-select"
                value={filters.creative_style}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    creative_style: e.target.value,
                  }))
                }
              >
                <option value="All">Style</option>
                {filterOptions.creativeStyles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {tab === "creatives" && (
          <section className="brand-creatives" aria-label="Brand creatives">
            <div className="brand-creatives__meta">
              <span>{filteredAds.length} result{filteredAds.length !== 1 ? "s" : ""}</span>
            </div>
            {filteredAds.length > 0 ? (
              <div className="brand-grid">
                {filteredAds.map((ad, i) => (
                  <button
                    className="brand-grid__item"
                    key={ad.id}
                    type="button"
                    onClick={() => setSelectedAd(ad)}
                    aria-label={`View ${ad.brand.name} creative`}
                  >
                    <CreativePreview ad={ad} compact priority={i < 4} />
                    <div className="brand-grid__caption">
                      <strong>{ad.headline || "No headline"}</strong>
                      <small>
                        {ad.format} · {ad.hook || "No hook"}
                      </small>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="brand-empty">
                <p>No creatives match the current filters.</p>
                <button className="dir-btn" type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            )}
          </section>
        )}

        {tab === "headlines" && (
          <section className="brand-list" aria-label="Headlines">
            {filteredAds.length > 0 ? (
              <div className="brand-table">
                <div className="brand-table__head">
                  <span>Headline</span>
                  <span>Format</span>
                  <span>Hook</span>
                  <span>Funnel</span>
                  <span>Seen</span>
                </div>
                {filteredAds.map((ad) => (
                  <button
                    className="brand-table__row"
                    key={ad.id}
                    type="button"
                    onClick={() => setSelectedAd(ad)}
                  >
                    <span className="brand-table__headline">
                      {ad.headline || "—"}
                    </span>
                    <span>{ad.format}</span>
                    <span>{ad.hook || "—"}</span>
                    <span>{ad.funnel_stage || "—"}</span>
                    <span>
                      {new Date(ad.first_seen_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="brand-empty">
                <p>No headlines match the current filters.</p>
              </div>
            )}
          </section>
        )}

        {tab === "copy" && (
          <section className="brand-list" aria-label="Ad copy">
            {filteredAds.filter((ad) => ad.body_copy).length > 0 ? (
              <div className="brand-copy-grid">
                {filteredAds
                  .filter((ad) => ad.body_copy)
                  .map((ad) => (
                    <article className="brand-copy-card" key={ad.id}>
                      <p className="brand-copy-card__text">{ad.body_copy}</p>
                      <div className="brand-copy-card__meta">
                        <span>{ad.format}</span>
                        <span>{ad.hook || "No hook"}</span>
                        <span>{ad.language}</span>
                        <span>
                          {new Date(ad.first_seen_at).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <div className="brand-empty">
                <p>No ad copy captured for this brand yet.</p>
              </div>
            )}
          </section>
        )}

        {tab === "hooks" && (
          <section className="brand-analysis" aria-label="Hook analysis">
            <div className="brand-analysis__grid">
              <div className="brand-analysis__card">
                <h3>Hooks by frequency</h3>
                <div className="brand-bar-list">
                  {insights.byHook.map((item) => (
                    <div className="brand-bar-item" key={item.label}>
                      <span className="brand-bar-item__label">{item.label}</span>
                      <div className="brand-bar-item__track">
                        <div
                          className="brand-bar-item__fill"
                          style={{
                            width: `${(item.count / (insights.byHook[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="brand-bar-item__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="brand-analysis__card">
                <h3>Funnel stages</h3>
                <div className="brand-bar-list">
                  {insights.byFunnel.map((item) => (
                    <div className="brand-bar-item" key={item.label}>
                      <span className="brand-bar-item__label">{item.label}</span>
                      <div className="brand-bar-item__track">
                        <div
                          className="brand-bar-item__fill brand-bar-item__fill--accent"
                          style={{
                            width: `${(item.count / (insights.byFunnel[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="brand-bar-item__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="brand-analysis__card">
                <h3>Languages</h3>
                <div className="brand-bar-list">
                  {insights.byLang.map((item) => (
                    <div className="brand-bar-item" key={item.label}>
                      <span className="brand-bar-item__label">{item.label}</span>
                      <div className="brand-bar-item__track">
                        <div
                          className="brand-bar-item__fill brand-bar-item__fill--warm"
                          style={{
                            width: `${(item.count / (insights.byLang[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="brand-bar-item__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "formats" && (
          <section className="brand-analysis" aria-label="Format analysis">
            <div className="brand-analysis__grid">
              <div className="brand-analysis__card">
                <h3>Creative formats</h3>
                <div className="brand-bar-list">
                  {insights.byFormat.map((item) => (
                    <div className="brand-bar-item" key={item.label}>
                      <span className="brand-bar-item__label">{item.label}</span>
                      <div className="brand-bar-item__track">
                        <div
                          className="brand-bar-item__fill"
                          style={{
                            width: `${(item.count / (insights.byFormat[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="brand-bar-item__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="brand-analysis__card">
                <h3>Creative styles</h3>
                <div className="brand-bar-list">
                  {insights.byStyle.map((item) => (
                    <div className="brand-bar-item" key={item.label}>
                      <span className="brand-bar-item__label">{item.label}</span>
                      <div className="brand-bar-item__track">
                        <div
                          className="brand-bar-item__fill brand-bar-item__fill--accent"
                          style={{
                            width: `${(item.count / (insights.byStyle[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="brand-bar-item__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {tab === "angles" && (
          <section className="brand-analysis" aria-label="Selling angle analysis">
            <div className="brand-analysis__grid">
              <div className="brand-analysis__card brand-analysis__card--wide">
                <h3>Selling angles</h3>
                <div className="brand-bar-list">
                  {insights.byAngle.map((item) => (
                    <div className="brand-bar-item" key={item.label}>
                      <span className="brand-bar-item__label">{item.label}</span>
                      <div className="brand-bar-item__track">
                        <div
                          className="brand-bar-item__fill brand-bar-item__fill--warm"
                          style={{
                            width: `${(item.count / (insights.byAngle[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="brand-bar-item__count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter />

      {selectedAd && (
        <dialog
          className="ad-dialog"
          open
          onClose={() => setSelectedAd(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAd(null);
          }}
        >
          <div className="ad-dialog__layout">
            <header className="ad-dialog__header">
              <strong>{selectedAd.brand.name}</strong>
              <button
                className="icon-button"
                type="button"
                onClick={() => setSelectedAd(null)}
                aria-label="Close"
              >
                <X size={18} strokeWidth={1.8} />
              </button>
            </header>
            <div className="ad-dialog__body">
              <div className="ad-dialog__creative">
                <CreativePreview ad={selectedAd} priority />
              </div>
              <div className="detail-copy">
                <div>
                  <p>
                    {selectedAd.category} · {selectedAd.format}
                  </p>
                  <h2>{selectedAd.headline || "No headline captured"}</h2>
                </div>
                {selectedAd.body_copy && <p>{selectedAd.body_copy}</p>}
                <dl className="detail-list">
                  <div>
                    <dt>Creative style</dt>
                    <dd>{selectedAd.creative_style || selectedAd.format || "Not tagged"}</dd>
                  </div>
                  <div>
                    <dt>Message angle</dt>
                    <dd>{selectedAd.selling_angle || "Not tagged"}</dd>
                  </div>
                  <div>
                    <dt>Hook</dt>
                    <dd>{selectedAd.hook || "Not tagged"}</dd>
                  </div>
                  <div>
                    <dt>Funnel stage</dt>
                    <dd>{selectedAd.funnel_stage || "Not tagged"}</dd>
                  </div>
                  <div>
                    <dt>Language</dt>
                    <dd>{selectedAd.language}</dd>
                  </div>
                  <div>
                    <dt>CTA</dt>
                    <dd>{selectedAd.cta || "Not captured"}</dd>
                  </div>
                  <div>
                    <dt>First seen</dt>
                    <dd>
                      {new Date(selectedAd.first_seen_at).toLocaleDateString(
                        "en-IN",
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        },
                      )}
                    </dd>
                  </div>
                </dl>
                <div className="button-row">
                  <a
                    className="button button--primary"
                    href={selectedAd.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open source{" "}
                    <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
                  </a>
                  <button
                    className="button"
                    type="button"
                    onClick={() => setSelectedAd(null)}
                  >
                    Back to library
                  </button>
                </div>
              </div>
            </div>
          </div>
        </dialog>
      )}
    </>
  );
}
