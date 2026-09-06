"use client";

import { Children, useLayoutEffect, useRef, type ReactNode } from "react";

/** Intrinsic-height packing; DOM order stays unchanged for keyboard navigation. */
export function MasonryGrid({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return;
    const items = Array.from(grid.children) as HTMLElement[];
    let frame = 0;

    const layout = () => {
      const styles = getComputedStyle(grid);
      const columns = Number(styles.getPropertyValue("--masonry-columns")) || 2;
      const gap = parseFloat(styles.columnGap) || 16;
      const heights = Array<number>(columns).fill(0);
      grid.dataset.ready = "true";
      // Read all sizes before writing positions; no per-card forced layout.
      const sizes = items.map(item => item.getBoundingClientRect().height);
      items.forEach((item, index) => {
        const column = heights.indexOf(Math.min(...heights));
        item.style.left = `calc(${column} * ((100% + ${gap}px) / ${columns}))`;
        item.style.top = `${heights[column]}px`;
        heights[column] += sizes[index] + gap;
      });
      grid.style.height = `${Math.max(0, ...heights)}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(layout);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(grid);
    items.forEach(item => observer.observe(item));
    layout();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div className="ad-grid" aria-label="Approved ads" ref={ref}>
      {Children.map(children, child => <div className="masonry-item">{child}</div>)}
    </div>
  );
}
