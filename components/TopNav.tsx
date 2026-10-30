"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

// On phones the tabs and account links fold into a Menu button so the top bar stays one short row.
// On wider screens everything shows inline, as before.
// child keeps a parent's chosen child selected when they switch tabs.
export function TopNav({ tabs, active, child, name, role, waiting }: {
  tabs: [string, string][]; active: string; child?: number; name: string; role: string; waiting: number;
}) {
  const [open, setOpen] = useState(false);
  const withChild = (href: string) => (child ? `${href}${href.includes("?") ? "&" : "?"}child=${child}` : href);
  const current = tabs.find(([href]) => href === active)?.[1];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {current && <span className="top-here">{current}</span>}
      <button type="button" className="small menu-btn" aria-expanded={open} aria-controls="top-menu" onClick={() => setOpen(!open)}>
        {open ? "Close" : "Menu"}
        {!open && waiting > 0 && <span className="dot" aria-label={`${waiting} waiting`} />}
      </button>
      <div id="top-menu" className={open ? "top-menu open" : "top-menu"}>
        <nav className="tabs">
          {tabs.map(([href, label]) => (
            <Link key={href} href={withChild(href)} className="tab" aria-current={active === href} onClick={() => setOpen(false)}>
              {label}
              {href === "/admin/approvals" && waiting > 0 && <span className="count num">{waiting}</span>}
            </Link>
          ))}
        </nav>
        <div className="who">
          <span>
            {name} · <span className="chip c-info">{role}</span>
          </span>
          <Link href="/password" className="small" onClick={() => setOpen(false)}>Password</Link>
          <form action="/logout" method="post">
            <button className="small" type="submit">Sign out</button>
          </form>
        </div>
      </div>
    </>
  );
}
