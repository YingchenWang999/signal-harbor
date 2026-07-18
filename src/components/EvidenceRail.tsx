import { Check, ExternalLink } from "lucide-react";
import type { EvidenceSnapshot } from "../lib/flare";
import { shortHex } from "../lib/flare";

function ageLabel(timestamp: number) {
  const minutes = Math.max(0, Math.floor((Date.now() / 1000 - timestamp) / 60));
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function EvidenceRail({ evidence, loading }: { evidence: EvidenceSnapshot[]; loading: boolean }) {
  return (
    <section className="panel evidence-panel">
      <div className="panel-heading compact">
        <div><span className="eyebrow">FDC evidence</span><h2>Cross-chain log</h2></div>
        <span className="count-pill">{evidence.length.toString().padStart(2, "0")}</span>
      </div>
      <div className="evidence-list">
        {evidence.map((item) => (
          <article key={item.evidenceId} className="evidence-item">
            <span className="proof-check"><Check size={12} strokeWidth={3} /></span>
            <div>
              <strong>XRPL payment verified</strong>
              <span>{item.sourceId} · {shortHex(item.transactionId)} · {item.amountXrp} XRP</span>
            </div>
            <div className="proof-meta">
              <span>{ageLabel(item.sourceTimestamp)}</span>
              <a href={`https://testnet.xrpl.org/transactions/${item.transactionId.slice(2)}`} target="_blank" rel="noreferrer" aria-label="Open verified XRPL payment"><ExternalLink size={13} /></a>
            </div>
          </article>
        ))}
        {!loading && evidence.length === 0 && <p className="empty-evidence">No verified evidence events found.</p>}
      </div>
      <p className="proof-note">Live Coston2 events · FDC voting round {evidence[0]?.votingRound ?? "—"} · Merkle-proof verified onchain.</p>
    </section>
  );
}
