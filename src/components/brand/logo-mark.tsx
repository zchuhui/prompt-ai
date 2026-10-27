/** 图种：取景框中的萌芽种子。几何与 src/app/icon.svg 保持一致。 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 32 32">
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
        <path d="M3 10V3h7m12 0h7v7m0 12v7h-7m-12 0H3v-7" />
        <path d="M11 23C7 13 14 7 23 9c2 9-4 16-12 14Z" />
        <path d="m10 24 9-10" />
      </g>
    </svg>
  );
}
