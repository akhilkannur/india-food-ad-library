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

export function AdDetailDialog({ ad, onClose }: { ad: Ad | null; onClose: () => void }) {
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
            <CreativePreview ad={ad} priority />
          </div>
          <div className="detail-copy">
            <div>
              <p>{ad.category} · {ad.format}</p>
              <h2>{ad.headline || "No headline captured"}</h2>
            </div>
            {ad.body_copy && <p>{ad.body_copy}</p>}
            <dl className="detail-list">
              <div><dt>Hook</dt><dd>{ad.hook || "Not tagged"}</dd></div>
              <div><dt>Funnel stage</dt><dd>{ad.funnel_stage || "Not tagged"}</dd></div>
              <div><dt>Language</dt><dd>{ad.language}</dd></div>
              <div><dt>CTA</dt><dd>{ad.cta || "Not captured"}</dd></div>
              <div><dt>First seen</dt><dd>{formatDate(ad.first_seen_at)}</dd></div>
              <div><dt>Occasion</dt><dd>{ad.occasion || "Evergreen"}</dd></div>
            </dl>
            <div className="button-row">
              <a className="button button--primary" href={ad.source_url} target="_blank" rel="noreferrer">
                Open source <ArrowUpRight aria-hidden="true" size={15} strokeWidth={1.8} />
              </a>
              <button className="button" type="button" onClick={onClose}>Back to library</button>
            </div>
          </div>
        </div>
      </div>
    </dialog>
  );
}
