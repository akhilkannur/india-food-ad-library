"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

export function AuthGateDialog({
  open,
  busy,
  error,
  onClose,
  onSignIn,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="auth-dialog__card">
        <button className="auth-dialog__close" type="button" onClick={onClose} aria-label="Close sign in">
          <X aria-hidden="true" size={18} />
        </button>
        <p>Sign in to continue</p>
        <h2>View more ads.</h2>
        <span>Sign in to keep viewing ads across the library.</span>
        <button className="auth-dialog__google" type="button" onClick={onSignIn} disabled={busy}>
          <span aria-hidden="true">G</span>
          {busy ? "Connecting…" : "Continue with Google"}
        </button>
        {error && <p className="auth-dialog__error" role="alert">{error}</p>}
      </div>
    </dialog>
  );
}
