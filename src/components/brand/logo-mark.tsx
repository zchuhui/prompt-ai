import { useId } from "react";

/** 与 src/app/icon.svg 保持同一图形：画框里的提示符。 */
export function LogoMark({ className }: { className?: string }) {
  const raw = useId().replaceAll(":", "");
  const stroke = `${raw}-stroke`;
  const fill = `${raw}-fill`;

  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32">
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id={stroke} x1="1" x2="31" y1="1" y2="31">
          <stop stopColor="#7af3ff" />
          <stop offset="0.55" stopColor="#22d3ee" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <linearGradient gradientUnits="userSpaceOnUse" id={fill} x1="16" x2="16" y1="2" y2="30">
          <stop stopColor="#141a22" />
          <stop offset="1" stopColor="#07080a" />
        </linearGradient>
      </defs>
      <rect fill={`url(#${fill})`} height="29.7" rx="8" stroke={`url(#${stroke})`} strokeWidth="1.7" width="29.7" x="1.15" y="1.15" />
      <path d="M7.7 9.15 14.55 16 7.7 22.85 10.55 22.85 17.4 16 10.55 9.15Z" fill="#22d3ee" />
      <rect fill="#22d3ee" height="3.3" rx="0.7" width="5.5" x="19.15" y="19.55" />
    </svg>
  );
}
