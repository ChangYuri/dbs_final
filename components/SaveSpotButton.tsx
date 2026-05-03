"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import type { Spot } from "@/lib/spots";

type SaveSpotButtonProps = {
  spot: Spot;
  saved: boolean;
  onToggle: (spot: Spot, saved: boolean) => void;
  className?: string;
  showLabel?: boolean;
};

export default function SaveSpotButton({ spot, saved, onToggle, className = "", showLabel = false }: SaveSpotButtonProps) {
  const label = saved ? `Unsave ${spot.title}` : `Save ${spot.title}`;

  return (
    <button
      className={`save-spot-button${saved ? " is-saved" : ""}${showLabel ? " with-label" : ""}${className ? ` ${className}` : ""}`}
      type="button"
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(spot, !saved);
      }}
    >
      {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      {showLabel ? <span>{saved ? "Saved" : "Save"}</span> : null}
    </button>
  );
}
