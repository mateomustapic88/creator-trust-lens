import { useEffect, useMemo, useState } from "react";
import { analyzeProfile } from "../../lib/analysis/analyze";
import type { AnalysisResult, ScanSession } from "../../lib/analysis/types";
import type { ExtensionResponse } from "../../lib/messages";
import { MESSAGE_TYPES } from "../../lib/messages";
import {
  ACTIVE_SESSION_KEY,
  addCapturedPost,
  buildProfileSample,
  createScanSession,
  getNextPostUrl,
  isCapturedPost,
  isSessionPost,
} from "../../lib/scanning/session";

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

async function saveSession(session?: ScanSession): Promise<void> {
  if (session) {
    await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: session });
  } else {
    await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
  }
}

export function App() {
  const [session, setSession] = useState<ScanSession>();
  const [result, setResult] = useState<AnalysisResult>();
  const [activeUrl, setActiveUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void chrome.storage.local.get(ACTIVE_SESSION_KEY).then((stored) => {
      setSession(stored[ACTIVE_SESSION_KEY] as ScanSession | undefined);
    });

    const syncActiveUrl = async () => setActiveUrl((await getActiveTab())?.url);
    void syncActiveUrl();

    const onUpdated = (_tabId: number, change: { url?: string }) => {
      if (change.url) setActiveUrl(change.url);
    };
    const onActivated = () => void syncActiveUrl();
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(onActivated);

    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
    };
  }, []);

  const nextPostUrl = useMemo(
    () => (session ? getNextPostUrl(session) : undefined),
    [session],
  );
  const viewingSessionPost = session ? isSessionPost(session, activeUrl) : false;
  const viewingCapturedPost = session ? isCapturedPost(session, activeUrl) : false;

  async function sendToActiveTab(type: string): Promise<ExtensionResponse> {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://www.instagram.com/")) {
      throw new Error("Open Instagram in the active tab first.");
    }
    return chrome.tabs.sendMessage(tab.id, { type });
  }

  async function startScan() {
    setWorking(true);
    setError(undefined);
    setResult(undefined);

    try {
      const response = await sendToActiveTab(MESSAGE_TYPES.discoverProfile);
      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "profile") throw new Error("Expected profile data.");

      const nextSession = createScanSession(response.profile);
      setSession(nextSession);
      await saveSession(nextSession);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally {
      setWorking(false);
    }
  }

  async function openNextPost() {
    if (!nextPostUrl) return;
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await chrome.tabs.update(tab.id, { url: nextPostUrl });
  }

  async function captureCurrentPost() {
    if (!session) return;
    setWorking(true);
    setError(undefined);

    try {
      const response = await sendToActiveTab(MESSAGE_TYPES.capturePost);
      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "post") throw new Error("Expected post data.");

      const nextSession = addCapturedPost(session, response.post);
      setSession(nextSession);
      await saveSession(nextSession);
    } catch (captureError) {
      setError(
        captureError instanceof Error ? captureError.message : "Capture failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function finishScan() {
    if (!session) return;
    const analysis = analyzeProfile(buildProfileSample(session));
    setResult(analysis);
    await chrome.storage.local.set({ [`scan:${analysis.handle}`]: analysis });
    setSession(undefined);
    await saveSession(undefined);
  }

  async function cancelScan() {
    setSession(undefined);
    setResult(undefined);
    setError(undefined);
    await saveSession(undefined);
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

      {!session && !result && (
        <section className="empty-card">
          <p className="eyebrow">EVIDENCE, NOT ACCUSATIONS</p>
          <h2>Inspect visible engagement signals.</h2>
          <p>
            Open a public Instagram profile. You will review recent posts and
            choose exactly which visible comments to include.
          </p>
          <button onClick={startScan} disabled={working}>
            {working ? "DISCOVERING POSTS…" : "START GUIDED SCAN"}
          </button>
          {error && <p className="error">{error}</p>}
        </section>
      )}

      {session && (
        <section className="session-card">
          <div className="session-heading">
            <div>
              <p className="eyebrow">ACTIVE SCAN</p>
              <h2>@{session.handle}</h2>
            </div>
            <span className="progress-count">
              {session.capturedPosts.length}/{session.postUrls.length}
            </span>
          </div>

          <div className="progress-track" aria-label="Scan progress">
            <span
              style={{
                width: `${(session.capturedPosts.length / session.postUrls.length) * 100}%`,
              }}
            />
          </div>

          {viewingSessionPost && !viewingCapturedPost ? (
            <div className="instruction">
              <strong>Post ready to capture</strong>
              <p>
                Load any additional comments you want included, then capture the
                currently visible sample.
              </p>
              <button onClick={captureCurrentPost} disabled={working}>
                {working ? "CAPTURING…" : "CAPTURE VISIBLE COMMENTS"}
              </button>
            </div>
          ) : nextPostUrl ? (
            <div className="instruction">
              <strong>Continue the guided scan</strong>
              <p>Open the next discovered post without collecting anything automatically.</p>
              <button onClick={openNextPost}>OPEN NEXT POST</button>
            </div>
          ) : (
            <div className="instruction">
              <strong>All discovered posts captured</strong>
              <p>Finish the scan to calculate the evidence-based trust score.</p>
            </div>
          )}

          <dl className="sample-stats">
            <div>
              <dt>Posts captured</dt>
              <dd>{session.capturedPosts.length}</dd>
            </div>
            <div>
              <dt>Comments captured</dt>
              <dd>
                {session.capturedPosts.reduce(
                  (total, post) => total + post.comments.length,
                  0,
                )}
              </dd>
            </div>
          </dl>

          <button
            className="secondary"
            onClick={finishScan}
            disabled={session.capturedPosts.length === 0}
          >
            FINISH AND ANALYSE
          </button>
          <button className="text-button" onClick={cancelScan}>Cancel scan</button>
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
                {item.examples.length > 0 && (
                  <ul>
                    {item.examples.map((example) => <li key={example}>{example}</li>)}
                  </ul>
                )}
              </article>
            ))}
          </section>

          <button className="secondary" onClick={() => setResult(undefined)}>
            START ANOTHER SCAN
          </button>
        </>
      )}

      <footer>Analysis shows observable signals, not proof.</footer>
    </main>
  );
}
