import { priceTrail } from "../data/demo";

interface RadarProps {
  price: number;
  live: boolean;
}

export function Radar({ price, live }: RadarProps) {
  const min = Math.min(...priceTrail);
  const max = Math.max(...priceTrail);
  const points = priceTrail.map((value, index) => {
    const angle = -156 + index * (132 / (priceTrail.length - 1));
    const radius = 126 - ((value - min) / (max - min)) * 34;
    const rad = (angle * Math.PI) / 180;
    return `${180 + Math.cos(rad) * radius},${184 + Math.sin(rad) * radius}`;
  }).join(" ");

  return (
    <div className="radar" aria-label={`FXRP price signal ${price.toFixed(4)} dollars`}>
      <svg viewBox="0 0 360 280" role="img" aria-hidden="true">
        <defs>
          <filter id="soft"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <path className="radar-horizon" d="M28 186 A152 152 0 0 1 332 186" />
        <path className="radar-ring" d="M63 186 A117 117 0 0 1 297 186" />
        <path className="radar-ring inner" d="M98 186 A82 82 0 0 1 262 186" />
        {[46, 79, 112, 145, 178, 211, 244, 277, 310].map((x) => (
          <line key={x} className="radar-tick" x1={x} y1="182" x2={x} y2="190" />
        ))}
        <line className="radar-beam-glow" x1="180" y1="186" x2="295" y2="84" filter="url(#soft)" />
        <line className="radar-beam" x1="180" y1="186" x2="295" y2="84" />
        <polyline className="signal-trail" points={points} />
        <circle className="signal-point pulse" cx="295" cy="84" r="5" />
        <circle className="radar-origin" cx="180" cy="186" r="4" />
      </svg>
      <div className="radar-reading">
        <span className="eyebrow">XRP / USD</span>
        <strong>${price.toFixed(4)}</strong>
        <span className={`live-state ${live ? "is-live" : ""}`}>
          <i /> {live ? "FTSO live" : "preview signal"}
        </span>
      </div>
      <div className="radar-scale left">−15%</div>
      <div className="radar-scale right">+15%</div>
    </div>
  );
}
