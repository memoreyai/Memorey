import { cn } from "@/lib/utils";

interface MemoreyLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

/** Letter M with two nodes and an edge inside — graph metaphor */
export function MemoreyLogo({
  className,
  size = 40,
  showWordmark = false,
}: MemoreyLogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        className="shrink-0"
      >
        <rect
          width="40"
          height="40"
          rx="8"
          className="fill-[#141416] stroke-[#2A2A2D]"
          strokeWidth="1"
        />
        {/* M strokes */}
        <path
          d="M11 28V12L16 20L20 14L24 20L29 12V28"
          stroke="#F5F4F0"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Node graph inside left leg of M */}
        <circle cx="14" cy="22" r="2" fill="#5DCAA5" />
        <circle cx="18" cy="18" r="2" fill="#5DCAA5" />
        <line
          x1="14"
          y1="22"
          x2="18"
          y2="18"
          stroke="#5DCAA5"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight text-[#F5F4F0]">
          Memorey
        </span>
      )}
    </div>
  );
}
