"use client";

import type { CSSProperties, ElementType } from "react";

export type TextAnimationType =
  | "rollIn"
  | "whipIn"
  | "fadeIn"
  | "popIn"
  | "fadeInUp"
  | "shiftInUp"
  | "whipInUp"
  | "calmInUp";

export type TextAnimateProps = {
  text: string;
  type?: TextAnimationType;
  className?: string;
  as?: ElementType;
};

export default function TextAnimate({
  text,
  type = "fadeIn",
  className,
  as: Component = "span",
}: TextAnimateProps) {
  const words = text.split(" ");

  return (
    <Component
      className={["text-animate", `text-animate--${type}`, className].filter(Boolean).join(" ")}
      aria-label={text}
    >
      {words.map((word, index) => (
        <span
          aria-hidden="true"
          className="text-animate__word"
          key={`${word}-${index}`}
          style={{ "--text-index": index } as CSSProperties}
        >
          {word}{index < words.length - 1 ? "\u00a0" : ""}
        </span>
      ))}
    </Component>
  );
}
