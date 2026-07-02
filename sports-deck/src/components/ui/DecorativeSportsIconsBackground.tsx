"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type DecorativeSportsIconsBackgroundProps = {
  className?: string;
  iconClassName?: string;
};

const ICON_SOURCES = ["/goal.png", "/Goalkeeper-gloves-icon.png", "/person_kicking_black.png", "/soccer_ball.png"] as const;
const ICON_SIZES = ["h-11 w-11 sm:h-14 sm:w-14", "h-12 w-12 sm:h-16 sm:w-16", "h-10 w-10 sm:h-13 sm:w-13"] as const;
const ICON_ROTATIONS = ["rotate-[-12deg]", "rotate-[-8deg]", "rotate-[-5deg]", "rotate-[6deg]", "rotate-[10deg]", "rotate-[14deg]"] as const;

function clamp(num: number, min: number, max: number) {
  return Math.min(max, Math.max(min, num));
}

export default function DecorativeSportsIconsBackground({ className, iconClassName }: DecorativeSportsIconsBackgroundProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 1000 });

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const updateSize = () => {
      const rect = node.getBoundingClientRect();
      setContainerSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const iconCount = useMemo(() => {
    const rowsFromHeight = Math.round(containerSize.height / 170);
    const widthScale = containerSize.width < 768 ? 0.8 : 1;
    const rows = Math.round(rowsFromHeight * widthScale);
    return clamp(rows * 2, 6, 34);
  }, [containerSize.height, containerSize.width]);

  const iconLayout = useMemo(() => {
    const rows = Math.ceil(iconCount / 2);

    return Array.from({ length: iconCount }, (_, idx) => {
      const row = Math.floor(idx / 2);
      const side = idx % 2 === 0 ? "left" : "right";
      const srcIndex = (row * 3 + (side === "right" ? 1 : 0)) % ICON_SOURCES.length;
      const baseY = ((row + 1) / (rows + 1)) * 100;
      const wobbleY = ((idx * 17) % 7) - 3;
      const topPercent = clamp(baseY + wobbleY, 2, 98);
      const edgeOffset = 1 + ((idx * 11) % 8);

      return {
        key: `${ICON_SOURCES[srcIndex]}-${idx}`,
        src: ICON_SOURCES[srcIndex],
        rotation: ICON_ROTATIONS[idx % ICON_ROTATIONS.length],
        size: ICON_SIZES[idx % ICON_SIZES.length],
        top: `${topPercent}%`,
        left: side === "left" ? `${edgeOffset}%` : undefined,
        right: side === "right" ? `${edgeOffset}%` : undefined,
      };
    });
  }, [iconCount]);

  return (
    <div ref={containerRef} className={cn("pointer-events-none absolute inset-0 z-0 overflow-hidden", className)} aria-hidden>
      {iconLayout.map((item, idx) => (
        <div
          key={item.key}
          className={cn(
            "absolute opacity-[0.22] sm:opacity-[0.28] dark:opacity-[0.4]",
            item.size,
            item.rotation,
          )}
          style={{ top: item.top, left: item.left, right: item.right }}
        >
          <Image
            src={item.src}
            alt=""
            fill
            className={cn("object-contain dark:invert dark:brightness-125", iconClassName)}
            sizes="72px"
          />
        </div>
      ))}
    </div>
  );
}
