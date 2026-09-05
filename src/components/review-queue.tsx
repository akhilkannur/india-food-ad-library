"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, CircleAlert, X } from "lucide-react";
import { CreativePreview } from "@/components/creative-preview";
import type { Ad, AdStatus } from "@/lib/types";

const tabs: { value: AdStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export function ReviewQueue({ initialAds, demoMode }: { initialAds: Ad[]; demoMode: boolean }) {
  const [ads, setAds] = useState(initialAds);
  const [activeStatus, setActiveStatus] = useState<AdStatus>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(
    () => Object.fromEntries(tabs.map((tab) => [tab.value, ads.filter((ad) => ad.status === tab.value).length])) as Record<AdStatus, number>,
    [ads],
  );
  const visibleAds = ads.filter((ad) => ad.status === activeStatus);

  async function decide(ad: Ad, status: AdStatus) {
    const previous = ads;
    setError(null);
    setBusyId(ad.id);
    setAds((items) => items.map((item) => item.id === ad.id ? { ...item, status } : item));

    if (!demoMode) {
      try {
        const response = await fetch(`/api/admin/ads/${ad.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (!response.ok) throw new Error(await response.text());
      } catch {
        setAds(previous);
        setError("The decision was not saved. Check the database connection and try again.");
      }
    }
    setBusyId(null);
  }

  return (
    <>
      {demoMode && (
        <div className="demo-banner">
          <CircleAlert aria-hidden="true" size={18} strokeWidth={1.8} />
          <p><strong>Demo mode.</strong> Decisions update this screen but are not persisted until Supabase is connected.</p>
        </div>
      )}
      {error && <div className="error-banner" role="alert"><CircleAlert aria-hidden="true" size={18} />{error}</div>}
      <div className="status-tabs" role="tablist" aria-label="Moderation status">
        {tabs.map((tab) => (
          <button
            className="status-tab"
            type="button"
            role="tab"
            key={tab.value}
            aria-selected={activeStatus === tab.value}
            onClick={() => setActiveStatus(tab.value)}
          >
            {tab.label}<span>{counts[tab.value]}</span>
          </button>
        ))}
      </div>

      {visibleAds.length ? (
        <section className="review-list" aria-label={`${activeStatus} ads`}>
          {visibleAds.map((ad) => (
            <article className="review-card" key={ad.id}>
              <CreativePreview ad={ad} compact />
              <div className="review-card__body">
                <div className="review-card__top">
                  <div>
                    <p className="review-card__brand">{ad.brand.name}</p>
                    <h2 className="review-card__title">{ad.headline || "Headline not available"}</h2>
                  </div>
                  <span className={`status-badge status-badge--${ad.status}`}>{ad.status}</span>
                </div>
                <p className="review-card__copy">{ad.body_copy || "No body copy captured."}</p>
                <p className="review-card__meta">
                  <span>{ad.category}</span><span>{ad.creative_style || ad.format}</span><span>{ad.selling_angle || "Angle untagged"}</span><span>{ad.language}</span>
                </p>
              </div>
              <div className="review-card__actions">
                {ad.status !== "approved" && (
                  <button className="button button--approve" type="button" disabled={busyId === ad.id} onClick={() => decide(ad, "approved")}>
                    <Check aria-hidden="true" size={15} /> {busyId === ad.id ? "Saving" : "Approve"}
                  </button>
                )}
                {ad.status !== "rejected" && (
                  <button className="button button--reject" type="button" disabled={busyId === ad.id} onClick={() => decide(ad, "rejected")}>
                    <X aria-hidden="true" size={15} /> Reject
                  </button>
                )}
                <a className="button" href={ad.source_url} target="_blank" rel="noreferrer">
                  Source <ArrowUpRight aria-hidden="true" size={15} />
                </a>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <h2>No {activeStatus} ads.</h2>
          <p>{activeStatus === "pending" ? "The review queue is clear." : `Ads moved to ${activeStatus} will appear here.`}</p>
        </section>
      )}
    </>
  );
}
