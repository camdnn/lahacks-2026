export function CartoonCoin({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ display: "block" }}>
      <ellipse cx="20" cy="37" rx="11" ry="3" fill="rgba(0,0,0,0.13)" />
      <circle cx="20" cy="19" r="17" fill="#F5C518" stroke="#B8860B" strokeWidth="2.5" />
      <circle cx="20" cy="19" r="12.5" fill="none" stroke="#D4960A" strokeWidth="1.5" opacity="0.7" />
      <ellipse cx="14" cy="13" rx="5" ry="2.8" fill="rgba(255,255,255,0.55)" transform="rotate(-25,14,13)" />
      <text x="20" y="25.5" textAnchor="middle" fontSize="14" fontWeight="900"
            fill="#7A5200" fontFamily="system-ui, sans-serif">$</text>
    </svg>
  );
}
