"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff, Play } from "lucide-react";
import type { Ad } from "@/lib/types";
import { isVideoCreative } from "@/lib/media";

const themes = new Set(["turmeric", "lime", "oat", "sea", "chilli", "cacao"]);

type CreativePreviewProps = {
  ad: Ad;
  compact?: boolean;
  inlinePlayback?: boolean;
  priority?: boolean;
  onUnavailable?: () => void;
};

function isUsablePoster(url: string | null) {
  return Boolean(url && !/[?/_-]s?\d{1,3}x\d{1,3}(?:[?/_&.-]|$)/i.test(url));
}

export function CreativePreview({ ad, compact = false, inlinePlayback = false, priority = false, onUnavailable }: CreativePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [nearViewport, setNearViewport] = useState(!inlinePlayback || priority);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [posterFailed, setPosterFailed] = useState<string | null>(null);
  const theme = themes.has(ad.creative_theme ?? "") ? ad.creative_theme : "oat";
  const video = isVideoCreative(ad) && Boolean(ad.creative_url);
  const imageUrl = video ? null : ad.creative_url || ad.thumbnail_url;
  const mediaUrl = video ? ad.creative_url! : imageUrl;
  const failed = Boolean(mediaUrl && failedUrl === mediaUrl);
  const poster = video && ad.thumbnail_url && ad.thumbnail_url !== ad.creative_url && isUsablePoster(ad.thumbnail_url)
    ? ad.thumbnail_url
    : undefined;
  const label = video ? "Video creative" : "Image creative";

  useEffect(() => {
    const player = videoRef.current;
    if (!player || !inlinePlayback) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setNearViewport(true);
      else player.pause();
    }, { rootMargin: "200px" });
    observer.observe(player);
    return () => observer.disconnect();
  }, [inlinePlayback, mediaUrl]);

  if (!failed && video && compact && !inlinePlayback) {
    return (
      <figure className={`creative creative--media creative--video creative--${theme}`} aria-label={`${label} for ${ad.brand.name}`}>
        {poster && posterFailed !== poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="creative__media" src={poster} alt={`${ad.brand.name} video preview`} loading={priority ? "eager" : "lazy"} onLoad={event => { event.currentTarget.dataset.loaded = "true"; }} onError={() => setPosterFailed(poster)} />
        ) : (
          <div className="creative__video-cover">
            <Play aria-hidden="true" size={28} />
            <strong>{ad.brand.name}</strong>
            <span>Open to watch the video</span>
          </div>
        )}
        <figcaption className="creative__format"><Play aria-hidden="true" size={12} /> Video</figcaption>
      </figure>
    );
  }

  if (!failed && video) {
    return (
      <figure className={`creative creative--media creative--video creative--${theme}`} aria-label={`${label} for ${ad.brand.name}`}>
        <video
          ref={videoRef}
          className="creative__media"
          aria-label={`${ad.brand.name} video`}
          src={nearViewport ? ad.creative_url! : undefined}
          poster={posterFailed !== poster ? poster : undefined}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={event => { event.currentTarget.dataset.loaded = "true"; }}
          onPlay={event => {
            document.querySelectorAll("video").forEach(player => {
              if (player !== event.currentTarget) player.pause();
            });
          }}
          onError={() => {
            setFailedUrl(ad.creative_url!);
          }}
        >
          Your browser does not support embedded video.
        </video>
        {!compact && <figcaption className="creative__format"><Play aria-hidden="true" size={12} fill="currentColor" /> Video</figcaption>}
      </figure>
    );
  }

  if (!failed && imageUrl) {
    return (
      <figure className={`creative creative--media creative--image creative--${theme}`} aria-label={`${label} for ${ad.brand.name}`}>
        {/* Dynamic advertiser media is rendered as-is; production URLs come from the approved record. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="creative__media"
          src={imageUrl}
          alt={`${ad.brand.name} advertising creative`}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          onLoad={event => { event.currentTarget.dataset.loaded = "true"; }}
          onError={() => {
            setFailedUrl(imageUrl);
            onUnavailable?.();
          }}
        />
        {!compact && <figcaption className="creative__format">Image</figcaption>}
      </figure>
    );
  }

  return (
    <div className={`creative creative--empty creative--${theme}`} role="img" aria-label={`Creative unavailable for ${ad.brand.name}`}>
      <span className="creative__missing-label">Preview unavailable</span>
      <span className="creative__empty-copy">
        <span>{ad.brand.name}</span>
        <strong>{ad.headline || "Creative not captured"}</strong>
        <small>{ad.category} · {ad.format}</small>
      </span>
      <span className="creative__empty-foot">
        <ImageOff aria-hidden="true" size={compact ? 16 : 20} strokeWidth={1.6} />
        {compact ? "Open details" : "Use the original ad link below to view this creative"}
      </span>
    </div>
  );
}
