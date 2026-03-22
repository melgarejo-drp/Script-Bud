"use client";

import { useState, useEffect, useCallback } from "react";

const SCRIPT_KEY = "sb_script_";
const IMAGES_KEY = "sb_images_";

/**
 * Shared hook for persisting fountain script text across editor & board.
 * Uses localStorage so data survives page navigation.
 */
export function useScript(projectId: string, defaultText: string = "") {
  const [text, setText] = useState(defaultText);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${SCRIPT_KEY}${projectId}`);
      if (saved) setText(saved);
    } catch {}
    setLoaded(true);
  }, [projectId]);

  const save = useCallback(
    (newText: string) => {
      setText(newText);
      try {
        localStorage.setItem(`${SCRIPT_KEY}${projectId}`, newText);
      } catch {}
    },
    [projectId]
  );

  return { text, save, loaded };
}

/**
 * Persist generated image URLs per scene slugline.
 */
export function useScriptImages(projectId: string) {
  const [images, setImages] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${IMAGES_KEY}${projectId}`);
      if (raw) setImages(JSON.parse(raw));
    } catch {}
  }, [projectId]);

  const saveImage = useCallback(
    (key: string, url: string) => {
      setImages((prev) => {
        const next = { ...prev, [key]: url };
        try {
          localStorage.setItem(`${IMAGES_KEY}${projectId}`, JSON.stringify(next));
        } catch {}
        return next;
      });
    },
    [projectId]
  );

  return { images, saveImage };
}
