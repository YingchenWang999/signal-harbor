import { calculatePortfolio } from "../lib/portfolio";

export function PositionTable({ price }: { price: number }) {
  const portfolio = calculatePortfolio(price);
  return (
    <section className="panel positions-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Watched positions</span>
          <h2>Harbor manifest</h2>
        </div>
        <span className="count-pill">{portfolio.positions.length.toString().padStart(2, "0")}</span>
      </div>
      <div className="position-list">
        {portfolio.positions.map((position) => (
            <article className="position-row" key={position.symbol}>
              <div className={`asset-mark ${position.status}`}>{position.symbol.slice(0, 1)}</div>
              <div className="asset-name"><strong>{position.symbol}</strong><span>{position.name}</span></div>
              <div className="allocation"><span style={{ width: `${position.allocation}%` }} /></div>
              <div className="asset-value"><strong>${position.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong><span>{position.allocation.toFixed(1)}% of treasury</span></div>
              <span className={`status-tag ${position.status}`}>{position.status}</span>
            </article>
        ))}
      </div>
    </section>
  );
}
