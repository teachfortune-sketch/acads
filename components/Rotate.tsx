"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// On a TV showing every class, move to the next class every few seconds.
export function Rotate({ next, seconds }: { next: string; seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(next), seconds * 1000);
    return () => clearTimeout(t);
  }, [router, next, seconds]);
  return null;
}
