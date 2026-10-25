"use client";
export function PrintButton() {
  return <button className="btn-p" type="button" onClick={() => window.print()}>Print receipt</button>;
}
