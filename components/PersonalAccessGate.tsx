"use client";

import { SignInButton } from "@clerk/nextjs";
import { ArrowRight, Lock, X } from "lucide-react";

type PersonalAccessGateProps = {
  open: boolean;
  title: string;
  copy: string;
  onClose: () => void;
  busy?: boolean;
  statusNote?: string | null;
};

export default function PersonalAccessGate({
  open,
  title,
  copy,
  onClose,
  busy = false,
  statusNote = null
}: PersonalAccessGateProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="auth-overlay" role="presentation" onClick={onClose}>
      <div
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="icon-button close-button auth-close" type="button" onClick={onClose} aria-label="Close sign in panel">
          <X size={18} />
        </button>
        <div className="auth-badge" aria-hidden="true">
          <Lock size={18} />
        </div>
        <h3 className="auth-title">{title}</h3>
        <p className="auth-copy">{copy}</p>
        {statusNote ? <p className="auth-note">{statusNote}</p> : null}
        <div className="auth-form">
          <SignInButton mode="modal">
            <button className="auth-submit" type="button" disabled={busy}>
              {busy ? "Opening Clerk..." : "Continue with Clerk"}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </SignInButton>
          <p className="auth-note">You will use your Clerk account for this session.</p>
        </div>
      </div>
    </div>
  );
}
