import "./HandTrackingToggle.scss";
import { HandTracker } from "./HandTracker"; 
import type { HandTrackingStatus } from "./HandTracker";

import React, { useCallback, useEffect, useRef, useState } from "react";

export const HandTrackingToggle = () => {
  const [status, setStatus] = useState<HandTrackingStatus>("idle");
  const trackerRef = useRef<HandTracker | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const toggle = useCallback(async () => {
    if (status === "active" || status === "loading") {
      trackerRef.current?.stop();
      trackerRef.current = null;
      if (previewRef.current) {
        previewRef.current.innerHTML = "";
      }
      return;
    }

    try {
      const tracker = new HandTracker(setStatus);
      trackerRef.current = tracker;
      await tracker.start();

      const video = tracker.getVideoElement();
      if (video && previewRef.current) {
        video.style.width = "160px";
        video.style.height = "120px";
        video.style.borderRadius = "8px";
        video.style.transform = "scaleX(-1)";
        video.style.objectFit = "cover";
        previewRef.current.innerHTML = "";
        previewRef.current.appendChild(video);
      }
    } catch (err) {
      console.error("Hand tracking failed:", err);
      setStatus("error");
    }
  }, [status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackerRef.current?.stop();
    };
  }, []);

  const isActive = status === "active";
  const isLoading = status === "loading";

  return (
    <div className="hand-tracking">
      <button
        className={`hand-tracking__toggle ${isActive ? "hand-tracking__toggle--active" : ""}`}
        onClick={toggle}
        disabled={isLoading}
        title={
          isActive
            ? "Disable hand tracking"
            : "Enable hand tracking (use webcam to control cursor)"
        }
      >
        <HandIcon />
        <span className="hand-tracking__label">
          {isLoading ? "Loading..." : isActive ? "Hand ON" : "Hand"}
        </span>
      </button>
      {isActive && (
        <div className="hand-tracking__preview" ref={previewRef} />
      )}
    </div>
  );
};

const HandIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v1" />
    <path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);
