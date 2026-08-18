import type { Ad } from "@/lib/types";

const themes = new Set(["turmeric", "lime", "oat", "sea", "chilli", "cacao"]);

export function CreativePreview({ ad, compact = false }: { ad: Ad; compact?: boolean }) {
  const theme = themes.has(ad.creative_theme ?? "") ? ad.creative_theme : "oat";

  return (
    <div className={`creative creative--${theme}`} aria-label={`Creative preview for ${ad.brand.name}`}>
      {ad.thumbnail_url ? (
        // Dynamic advertiser media is rendered as-is; approved production URLs come from Supabase.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="creative__image" src={ad.thumbnail_url} alt="" />
      ) : (
        <>
          <span className="creative__label">{compact ? "Demo" : "Demo creative"}</span>
          {!compact && <strong className="creative__headline">{ad.headline ?? ad.brand.name}</strong>}
          <span className="creative__object" aria-hidden="true" />
          {!compact && <span className="creative__footer">{ad.brand.name}</span>}
        </>
      )}
    </div>
  );
}
