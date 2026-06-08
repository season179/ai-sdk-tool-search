"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tracks the rendered height of an element via ResizeObserver. Returns a ref to
 * attach and the measured height in px (null until first measurement). Used to
 * drive the fixed-header / fixed-composer offsets that the chat and skills
 * shells share.
 */
export function useMeasuredHeight<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(element.getBoundingClientRect().height);
      setHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
    };
    const observer = new ResizeObserver(updateHeight);

    updateHeight();
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return [ref, height] as const;
}
