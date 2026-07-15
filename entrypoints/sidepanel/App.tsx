import { useState } from "react";
import { analyzeProfile } from "../../lib/analysis/analyze";
import type { AnalysisResult, ProfileSample } from "../../lib/analysis/types";

type ScanResponse =
  | { ok: true; sample: ProfileSample }
  | { ok: false; error: string };

const confidenceLabel: Record<AnalysisResult["confidence"], string> = {
  insufficient: "Insufficient data",
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

export function App() {
  const [result, setResult] = useState<AnalysisResult>();
  const [error, setError] = useState<string>();
  const [scanning, setScanning] = useState(false);

  async function scan() {
    setScanning(true);
    setError(undefined);

    try {
      const tab = await getActiveTab();
      if (!tab?.id || !tab.url?.startsWith("https://www.instagram.com/")) {
        throw new Error("Open a public Instagram profile in the active tab first.");
      }

      const response = (await chrome.tabs.sendMessage(tab.id, {
        type: "CREATOR_TRUST_LENS_SCAN_VISIBLE",
      })) as ScanResponse;

      if (!response.ok) throw new Error(response.error);

      const analysis = analyzeProfile(response.sample);
      setResult(analysis);
      await chrome.storage.local.set({ [`scan:${analysis.handle}`]: analysis });
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  const score = result?.trustScore;

  return (
    <main className="shell">
      <header className="brand">
        <div className="mask" aria-hidden="true">◒</div>
        <div>
          <p className="eyebrow">ENGAGEMENT X-RAY</p>
          <h1>Creator Trust Lens</h1>
        </div>
      </header>

      {!result && (
        <section className="empty-card">
          <p className="eyebrow">EVIDENCE, NOT ACCUSATIONS</p>
          <h2>Inspect visible engagement signals.</h2>
          <p>
            Open a public Instagram profile, then scan the information currently
            visible in your browser.
          </p>
          <button onClick={scan} disabled={scanning}>
            {scanning ? "SCANNING…" : "SCAN VISIBLE PROFILE"}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {result && (
        <>
          <section className="score-card">
            <p className="handle">@{result.handle}</p>
            <div className="score-ring">
              <strong>{score ?? "—"}</strong>
              <span>TRUST SCORE</span>
            </div>
            <p className="confidence">{confidenceLabel[result.confidence]}</p>
            <p className="sample">
              {result.postsScanned} posts · {result.commentsScanned} comments scanned
            </p>
          </section>

          <section className="evidence-grid">
            {result.evidence.map((item) => (
              <article className="evidence-card" key={item.id}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
                <p>{item.explanation}</p>
              </article>
            ))}
          </section>

          <button className="secondary" onClick={scan} disabled={scanning}>
            {scanning ? "SCANNING…" : "SCAN AGAIN"}
          </button>
        </>
      )}

      <footer>Analysis shows observable signals, not proof.</footer>
    </main>
  );
}
