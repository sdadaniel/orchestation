"use client";

import { useState, useEffect } from "react";

const HORSE_FRAMES = ["🐎", "🏇"];
const FRAME_INTERVAL = 400;

export function HorseRunningIndicator() {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex((prev) => (prev + 1) % HORSE_FRAMES.length);
    }, FRAME_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <span
      className="inline-flex items-center text-base"
      role="img"
      aria-label="running"
    >
      <span className="horse-bounce">{HORSE_FRAMES[frameIndex]}</span>
    </span>
  );
}
