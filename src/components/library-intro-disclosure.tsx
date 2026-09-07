"use client";

import { useEffect, useId, useState } from "react";
import { ChevronDown, Images, PanelRightOpen, Search } from "lucide-react";

const INTRO_STORAGE_KEY = "ifal-library-intro-seen";

const STEPS = [
  {
    title: "Choose the kind of creative",
    description: "Start with the complete library, or switch directly to video or image ads.",
    Icon: Images,
  },
  {
    title: "Narrow the field",
    description: "Search brands and ideas, then filter by category, format, selling angle, or language.",
    Icon: Search,
  },
  {
    title: "Inspect the details",
    description: "Open any creative to review its media, message, format, and campaign metadata together.",
    Icon: PanelRightOpen,
  },
] as const;

export function LibraryIntroDisclosure() {
  const contentId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(INTRO_STORAGE_KEY) !== "true");
    } catch {
      setOpen(true);
    }
  }, []);

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  function rememberAndClose() {
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, "true");
    } catch {
      // The disclosure still works when storage is unavailable.
    }
    setOpen(false);
  }

  function toggle() {
    if (open) rememberAndClose();
    else setOpen(true);
  }

  return (
    <section className={`library-intro${open ? " library-intro--open" : ""}`} aria-label="Library guide">
      <button
        className="library-intro__trigger"
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
      >
        <span>How this library works</span>
        <span className="library-intro__count">{step + 1} / {STEPS.length}</span>
        <ChevronDown aria-hidden="true" size={16} />
      </button>

      {open && (
        <div className="library-intro__content" id={contentId}>
          <div className="library-intro__visual" aria-hidden="true">
            <current.Icon size={30} strokeWidth={1.5} />
            <span>{String(step + 1).padStart(2, "0")}</span>
          </div>

          <div className="library-intro__copy" aria-live="polite">
            <h2>{current.title}</h2>
            <p>{current.description}</p>
            <div className="library-intro__progress" aria-hidden="true">
              {STEPS.map((item, index) => (
                <span className={index <= step ? "is-active" : ""} key={item.title} />
              ))}
            </div>
          </div>

          <div className="library-intro__actions">
            <button type="button" className="library-intro__skip" onClick={rememberAndClose}>Skip</button>
            {step > 0 && <button type="button" onClick={() => setStep((value) => value - 1)}>Back</button>}
            <button
              type="button"
              className="library-intro__next"
              onClick={() => isLastStep ? rememberAndClose() : setStep((value) => value + 1)}
            >
              {isLastStep ? "Start browsing" : "Next"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
