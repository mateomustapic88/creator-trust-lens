import { useEffect, useMemo, useState } from "react";
import { analyzeProfile } from "../../lib/analysis/analyze";
import type {
  AnalysisResult,
  ScanMode,
  ScanSession,
} from "../../lib/analysis/types";
import { createDemoProfileSample } from "../../lib/demo/sample";
import type {
  CaptureProgress,
  ExtensionRequest,
  ExtensionResponse,
  ExtensionRuntimeMessage,
} from "../../lib/messages";
import { MESSAGE_TYPES } from "../../lib/messages";
import {
  ACTIVE_SESSION_KEY,
  CURRENT_COLLECTOR_VERSION,
  addCapturedPost,
  buildProfileSample,
  createScanSession,
  getNextPostUrl,
  isCapturedPost,
  isSessionPost,
  skipPost,
} from "../../lib/scanning/session";
import {
  getScanModeConfig,
  SCAN_MODE_ORDER,
  SCAN_MODES,
} from "../../lib/scanning/modes";

const confidenceLabel: Record<AnalysisResult["confidence"], string> = {
  insufficient: "Insufficient data",
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

function getReviewLabel(result: AnalysisResult): string {
  if (result.trustScore === undefined) return "More data required";
  if (result.trustScore >= 75) return "Lower observed risk";
  if (result.trustScore >= 50) return "Review recommended";
  return "Elevated signals";
}

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
  const [showingDemo, setShowingDemo] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("standard");
  const [activeUrl, setActiveUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<CaptureProgress>();

  useEffect(() => {
    void chrome.storage.local.get(ACTIVE_SESSION_KEY).then((stored) => {
      const storedSession = stored[ACTIVE_SESSION_KEY] as ScanSession | undefined;
      if (
        storedSession &&
        storedSession.collectorVersion !== CURRENT_COLLECTOR_VERSION
      ) {
        void chrome.storage.local.remove(ACTIVE_SESSION_KEY);
        setError(
          "The Instagram collector was upgraded. Start a new scan so old partial captures are not reused.",
        );
        return;
      }
      setSession(storedSession);
    });

    const syncActiveUrl = async () => setActiveUrl((await getActiveTab())?.url);
    void syncActiveUrl();

    const onUpdated = (_tabId: number, change: { url?: string }) => {
      if (change.url) setActiveUrl(change.url);
    };
    const onActivated = () => void syncActiveUrl();
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onActivated.addListener(onActivated);
    const onRuntimeMessage = (message: ExtensionRuntimeMessage) => {
      if (message?.type === MESSAGE_TYPES.captureProgress) {
        setCaptureProgress(message);
      }
    };
    chrome.runtime.onMessage.addListener(onRuntimeMessage);

    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.runtime.onMessage.removeListener(onRuntimeMessage);
    };
  }, []);

  const nextPostUrl = useMemo(
    () => (session ? getNextPostUrl(session) : undefined),
    [session],
  );
  const viewingSessionPost = session ? isSessionPost(session, activeUrl) : false;
  const viewingCapturedPost = session ? isCapturedPost(session, activeUrl) : false;

  async function sendToActiveTab(
    message: ExtensionRequest,
  ): Promise<ExtensionResponse> {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url?.startsWith("https://www.instagram.com/")) {
      throw new Error("Open Instagram in the active tab first.");
    }
    return chrome.tabs.sendMessage(tab.id, message);
  }

  async function startScan() {
    setWorking(true);
    setError(undefined);
    setCaptureProgress(undefined);
    setResult(undefined);
    setShowingDemo(false);

    try {
      const response = await sendToActiveTab({
        type: MESSAGE_TYPES.discoverProfile,
      });
      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "profile") throw new Error("Expected profile data.");

      const nextSession = createScanSession(response.profile, scanMode);
      setSession(nextSession);
      await saveSession(nextSession);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    } finally {
      setWorking(false);
    }
  }

  function openDemoReport() {
    setError(undefined);
    setSession(undefined);
    setResult(analyzeProfile(createDemoProfileSample()));
    setShowingDemo(true);
  }

  async function openNextPost() {
    if (!nextPostUrl) return;
    const tab = await getActiveTab();
    if (!tab?.id) return;
    await chrome.tabs.update(tab.id, { url: nextPostUrl });
    setActiveUrl(nextPostUrl);
    setError(undefined);
  }

  async function skipCurrentPost() {
    if (!session || !activeUrl) return;

    const nextSession = skipPost(session, activeUrl);
    const followingPostUrl = getNextPostUrl(nextSession);
    setSession(nextSession);
    setError(undefined);
    await saveSession(nextSession);

    const tab = await getActiveTab();
    if (followingPostUrl && tab?.id) {
      await chrome.tabs.update(tab.id, { url: followingPostUrl });
      setActiveUrl(followingPostUrl);
    }
  }

  async function captureCurrentPost() {
    if (!session) return;
    setWorking(true);
    setError(undefined);

    try {
      const config = getScanModeConfig(session.mode);
      const response = await sendToActiveTab({
        type: MESSAGE_TYPES.capturePost,
        postUrl: activeUrl,
        maxComments: config.commentLimit,
      });
      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "post") throw new Error("Expected post data.");
      if (response.post.comments.length === 0) {
        throw new Error(
          "No visible comments found. Expand the comments on this post, wait for them to load, then try again.",
        );
      }

      const nextSession = addCapturedPost(session, response.post);
      setSession(nextSession);
      await saveSession(nextSession);
      setCaptureProgress(undefined);
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
    const config = getScanModeConfig(session.mode);
    const incompletePost = session.capturedPosts.find((post) => {
      const requiredComments = Math.min(
        config.commentLimit,
        post.commentCount ?? config.commentLimit,
      );
      return post.comments.length < requiredComments;
    });

    if (incompletePost) {
      const requiredComments = Math.min(
        config.commentLimit,
        incompletePost.commentCount ?? config.commentLimit,
      );
      setError(
        `A captured post has only ${incompletePost.comments.length} of ${requiredComments} required comments. Start a new scan to recapture it with the updated loader.`,
      );
      return;
    }

    const reviewedCount =
      session.capturedPosts.length + (session.skippedPostUrls?.length ?? 0);
    if (reviewedCount < session.postUrls.length) {
      setError(
        `Review or skip the remaining ${session.postUrls.length - reviewedCount} posts before finishing this ${config.label.toLowerCase()} scan.`,
      );
      return;
    }

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
    setShowingDemo(false);
    await saveSession(undefined);
  }

  const score = result?.trustScore;
  const activeModeConfig = session
    ? getScanModeConfig(session.mode)
    : getScanModeConfig(scanMode);
  const skippedPosts = session?.skippedPostUrls?.length ?? 0;
  const reviewedPosts = (session?.capturedPosts.length ?? 0) + skippedPosts;

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
          <div className="mode-picker" aria-label="Scan depth">
            {SCAN_MODE_ORDER.map((mode) => {
              const config = SCAN_MODES[mode];
              return (
                <button
                  className={scanMode === mode ? "mode-option selected" : "mode-option"}
                  key={mode}
                  onClick={() => setScanMode(mode)}
                  type="button"
                >
                  <strong>{config.label}</strong>
                  <span>{config.postLimit} posts · {config.commentLimit} comments each</span>
                </button>
              );
            })}
          </div>
          <button onClick={startScan} disabled={working}>
            {working ? "DISCOVERING POSTS…" : "START GUIDED SCAN"}
          </button>
          <button className="demo-button" onClick={openDemoReport} disabled={working}>
            VIEW SAMPLE REPORT
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
              <span className="mode-badge">{activeModeConfig.label} scan</span>
            </div>
            <span className="progress-count">
              {reviewedPosts}/{session.postUrls.length}
            </span>
          </div>

          <div className="progress-track" aria-label="Scan progress">
            <span
              style={{
                width: `${(reviewedPosts / session.postUrls.length) * 100}%`,
              }}
            />
          </div>

          {viewingSessionPost && !viewingCapturedPost ? (
            <div className="instruction">
              <strong>Post ready to capture</strong>
              <p>
                Creator Trust Lens will load comment batches up to a safe sample
                limit of {activeModeConfig.commentLimit}, then capture the visible
                results. This can take a few seconds.
              </p>
              {working && captureProgress && (
                <div className="collection-progress">
                  <div>
                    <span>Comments collected</span>
                    <strong>{captureProgress.collected}/{captureProgress.target}</strong>
                  </div>
                  <div className="collection-track" aria-label="Comment collection progress">
                    <span
                      style={{
                        width: `${Math.min(100, (captureProgress.collected / Math.max(1, captureProgress.target)) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>Loading batch {captureProgress.attempt} of {captureProgress.maxAttempts}</small>
                </div>
              )}
              <button onClick={captureCurrentPost} disabled={working}>
                {working && captureProgress
                  ? `LOADING ${captureProgress.collected}/${captureProgress.target}…`
                  : working
                    ? "PREPARING COMMENTS…"
                    : "LOAD AND CAPTURE SAMPLE"}
              </button>
              <button
                className="text-button"
                onClick={skipCurrentPost}
                disabled={working}
              >
                Skip this post
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
            {skippedPosts > 0 && (
              <div>
                <dt>Posts skipped</dt>
                <dd>{skippedPosts}</dd>
              </div>
            )}
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
            {showingDemo && <p className="demo-badge">SAMPLE DATA</p>}
            <p className="handle">@{result.handle}</p>
            <div className="score-ring">
              <strong>{score ?? "—"}</strong>
              <span>TRUST SCORE</span>
            </div>
            <p className="confidence">{confidenceLabel[result.confidence]}</p>
            <p className="review-label">{getReviewLabel(result)}</p>
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

          <button
            className="secondary"
            onClick={() => {
              setResult(undefined);
              setShowingDemo(false);
            }}
          >
            START ANOTHER SCAN
          </button>
        </>
      )}

      <footer>Analysis shows observable signals, not proof.</footer>
    </main>
  );
}
