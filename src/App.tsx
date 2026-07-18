import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Anchor, Bell, Boxes, CloudSun, Radio, ShieldCheck, TriangleAlert } from "lucide-react";
import { EvidenceRail } from "./components/EvidenceRail";
import { PositionTable } from "./components/PositionTable";
import { Radar } from "./components/Radar";
import { getEvidenceSnapshots, getFlareSnapshot, shortHex } from "./lib/flare";
import { calculatePortfolio } from "./lib/portfolio";

function App() {
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);
  const snapshot = useQuery({ queryKey: ["flare-snapshot"], queryFn: getFlareSnapshot, refetchInterval: 15_000 });
  const evidenceQuery = useQuery({ queryKey: ["fdc-evidence"], queryFn: getEvidenceSnapshots, refetchInterval: 30_000 });
  const fallbackPrice = 0.5184;
  const priceAge = snapshot.data ? Date.now() / 1000 - snapshot.data.timestamp : Number.POSITIVE_INFINITY;
  const fresh = priceAge >= 0 && priceAge <= 300;
  const live = Boolean(snapshot.data && snapshot.data.price > 0 && !snapshot.isError && fresh);
  const price = live && snapshot.data ? snapshot.data.price : fallbackPrice;
  const portfolio = calculatePortfolio(price);
  const riskLabel = portfolio.highestRisk.status === "act" ? "Action" : portfolio.highestRisk.status === "watch" ? "Watch" : "Low";

  async function runSweep() {
    setSweeping(true);
    setSweepResult(null);
    try {
      const next = await snapshot.refetch();
      if (next.error || !next.data) {
        setSweepResult("Sweep failed · Coston2 FTSO is currently unavailable");
        return;
      }
      const nextPortfolio = calculatePortfolio(next.data.price);
      const nextRisk = nextPortfolio.highestRisk.status;
      setSweepResult(
        `Sweep complete · XRP $${next.data.price.toFixed(4)} · ${nextRisk === "act" ? "action threshold crossed" : `${nextRisk} risk`}`,
      );
    } catch {
      setSweepResult("Sweep failed · Coston2 FTSO is currently unavailable");
    } finally {
      setSweeping(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Signal Harbor home"><Anchor size={19} /><span>SH</span></a>
        <nav aria-label="Primary navigation">
          <a className="active" href="#top" aria-label="Overview"><Activity size={18} /></a>
          <a href="#positions" aria-label="Positions"><Boxes size={18} /></a>
          <a href="#evidence" aria-label="Evidence"><ShieldCheck size={18} /></a>
          <a href="#alerts" aria-label="Alerts"><Bell size={18} /></a>
        </nav>
      </aside>

      <main id="top">
        <header className="topbar">
          <div className="wordmark"><strong>Signal Harbor</strong><span>Treasury weather, made actionable.</span></div>
          <div className="network-switcher" aria-label={`Coston2 ${live ? "connected" : "preview mode"}`}><i className={live ? "connected" : ""} /><span>Coston2</span></div>
        </header>

        <div className="content">
          <section className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow"><CloudSun size={14} /> Current treasury weather</span>
              <h1>Clear water.<br /><em>Signals ahead.</em></h1>
              <p>Flare-native price feeds and cross-chain proofs turn scattered treasury data into one response-ready picture.</p>
              <div className="hero-actions">
                <button className="primary-action" onClick={runSweep} disabled={sweeping}>{sweeping ? "Sweeping signals…" : "Run risk sweep"} <Radio size={15} /></button>
                <button className="quiet-action" onClick={() => document.querySelector("#alerts")?.scrollIntoView({ behavior: "smooth" })}>View response rules</button>
              </div>
              {sweepResult && <p className="sweep-result" role="status"><i />{sweepResult}</p>}
            </div>
            <div className="radar-wrap"><Radar price={price} live={live} /></div>
          </section>

          <section className="stat-strip" aria-label="Treasury summary">
            <article><span className="eyebrow">Protected value</span><strong>${portfolio.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong><small>Across {portfolio.positions.length} positions</small></article>
            <article><span className="eyebrow">Current exposure</span><strong>{riskLabel} <i className={`risk-dot ${portfolio.highestRisk.status}`} /></strong><small>{portfolio.highestRisk.symbol} · {portfolio.highestRisk.thresholdUsed.toFixed(1)}% of action threshold</small></article>
            <article><span className="eyebrow">FDC evidence</span><strong>{evidenceQuery.data?.length ?? 0} verified</strong><small>{evidenceQuery.data?.[0] ? `Round ${evidenceQuery.data[0].votingRound}` : evidenceQuery.isLoading ? "Reading Coston2 events…" : "No events found"}</small></article>
            <article className="source-stat"><span className="eyebrow">Data source</span><strong>{live ? "Block " + snapshot.data?.blockNumber.toString() : "Preview mode"}</strong><small>{live && snapshot.data ? shortHex(snapshot.data.ftsoAddress) : snapshot.isLoading ? "Connecting to FTSO…" : snapshot.data && !fresh ? "FTSO value is stale" : "Live RPC unavailable"}</small></article>
          </section>

          <div className="lower-grid">
            <div id="positions"><PositionTable price={price} /></div>
            <div id="evidence"><EvidenceRail evidence={evidenceQuery.data ?? []} loading={evidenceQuery.isLoading} /></div>
          </div>

          <section id="alerts" className="response-plan">
            <div className="response-icon"><TriangleAlert size={20} /></div>
            <div><span className="eyebrow">Prepared response</span><h2>If FXRP falls 15% below its reference price</h2><p>Queue a multisig proposal to reduce FXRP exposure by 20% and move proceeds to USDT0. Signal Harbor never takes custody.</p></div>
            <div className="response-state"><span>armed</span><strong>15%</strong><small>action threshold</small></div>
          </section>
        </div>

        <footer><span>Built for Flare Summer Signal · Coston2</span><span>FTSOv2 / FDC / FAssets</span></footer>
      </main>
    </div>
  );
}

export default App;
