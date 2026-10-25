"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps a points page current: new entries from class or reception show up within a few seconds.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
