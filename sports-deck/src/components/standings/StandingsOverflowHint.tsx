"use client";

import { useEffect, useState } from "react";

export default function StandingsOverflowHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function check() {
      const wrapper = document.getElementById("standings-wrapper");
      const table = document.getElementById("standings-table");
      if (!wrapper || !table) {
        setShow(false);
        return;
      }

      const wrapperWidth = wrapper.clientWidth;
      const tableScroll = table.scrollWidth;

      // Show hint if the table is overflowing and the wrapper width is at or below 600px
      if (tableScroll > wrapperWidth && wrapperWidth <= 600) {
        setShow(true);
      } else {
        setShow(false);
      }
    }

    check();
    window.addEventListener("resize", check);

    // Also observe for layout changes (e.g., fonts, images loaded)
    const wrapper = document.getElementById("standings-wrapper");
    let ro: ResizeObserver | null = null;
    if (wrapper && (window as any).ResizeObserver) {
      ro = new ResizeObserver(check);
      ro.observe(wrapper);
    }

    return () => {
      window.removeEventListener("resize", check);
      if (ro) ro.disconnect();
    };
  }, []);

  if (!show) return null;
  return (
    <div className="mb-2 sm:hidden">
      <p className="text-xs text-muted-foreground">Swipe to scroll horizontally</p>
    </div>
  );
}
