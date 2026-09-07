"use client";

import type { ButtonHTMLAttributes } from "react";

export type BorderBeamColorVariant = "colorful" | "ocean" | "sunset" | "mono";
export type BorderBeamSize = "sm" | "md" | "line";

export type BorderBeamButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  beamSize?: BorderBeamSize;
  borderBeamClassName?: string;
  colorVariant?: BorderBeamColorVariant;
  staticColors?: boolean;
  variant?: "default" | "outline" | "secondary" | "ghost";
};

export function BorderBeamButton({
  active = true,
  beamSize = "sm",
  borderBeamClassName,
  className,
  colorVariant = "colorful",
  staticColors = false,
  variant = "default",
  children,
  ...props
}: BorderBeamButtonProps) {
  return (
    <span
      className={[
        "border-beam",
        `border-beam--${beamSize}`,
        `border-beam--${colorVariant}`,
        active ? "is-active" : "",
        staticColors ? "is-static" : "",
        borderBeamClassName,
      ].filter(Boolean).join(" ")}
      data-slot="border-beam-button"
    >
      <span className="border-beam__light" aria-hidden="true" />
      <button
        className={["border-beam__button", `border-beam__button--${variant}`, className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </button>
    </span>
  );
}

export function BorderBeamIconButton(props: BorderBeamButtonProps) {
  return <BorderBeamButton {...props} className={["border-beam__icon-button", props.className].filter(Boolean).join(" ")} />;
}
