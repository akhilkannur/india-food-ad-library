"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { CreativePreview } from "@/components/creative-preview";
import type { Ad } from "@/lib/types";

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function AdDetailDialog({ ad, onClose, onUnavailable }: { ad: Ad | null; onClose: () => void; onUnavailable?: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (ad && !dialog.open) dialog.showModal();
    if (!ad && dialog.open) dialog.close();
  }, [ad]);

  if (!ad) return null;

  return (
    <dialog
      ref={dialogRef}
      className="ad-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="ad-dialog__layout">
        <header className="ad-dialog__header">
          <strong>{ad.brand.name}</strong>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close ad details">
            <X aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </header>
        <div className="ad-dialog__body">
          <div className="ad-dialog__creative">
            <CreativePreview ad={ad} priority onUnavailable={onUnavailable} />
          </div>
          <div className="detail-copy">
            <div>
              <p>{ad.category} · {ad.format}</p>
              <h2>{ad.headline || "Headline not available"}</h2>
            </div>
            {ad.body_copy && <p>{ad.body_copy}</p>}
            <dl className="detail-list">
              <div><dt>Ad format</dt><dd>{ad.creative_style || "Not classified"}</dd></div>
              <div><dt>Media type</dt><dd>{ad.format || "Not available"}</dd></div>
              <div><dt>Message angle</dt><dd>{ad.selling_angle || "Not classified"}</dd></div>
              <div><dt>Language</dt><dd>{ad.language}</dd></div>
              <div><dt>CTA</dt><dd>{ad.cta || "Not available"}</dd></div>
              <div><dt>First seen</dt><dd>{formatDate(ad.first_seen_at)}</dd></div>
            </dl>
            <div className="button-row">
              <a className="button button--primary" href={ad.source_url} target="_blank" rel="noreferrer">
                View original ad <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
              </a>
              <button className="button" type="button" onClick={onClose}>Back to library</button>
            </div>
            <aside className="ad-dialog__lisn-cta">
              <p>Want a street-interview ad like this for your food brand?</p>
              <a href="https://lisnagency.online" target="_blank" rel="noreferrer">See what LISN does <ArrowUpRight aria-hidden="true" size={14} strokeWidth={1.8} /></a>
            </aside>
          </div>
        </div>
      </div>
    </dialog>
  );
}
