import { useEffect, useMemo, useState } from "react";
import { analyzeProfile } from "../../lib/analysis/analyze";
import {
  appendHistorySnapshot,
  profileHistoryKey,
} from "../../lib/analysis/history";
import type {
  AnalysisResult,
  ProfileHistorySnapshot,
  ScanMode,
  ScanSession,
} from "../../lib/analysis/types";
import { createDemoProfileSample } from "../../lib/demo/sample";
import {
  exportAnalysisPdf,
  exportAnalysisXls,
} from "../../lib/export/report";
import type {
  CaptureProgress,
  ExtensionRequest,
  ExtensionResponse,
  ExtensionRuntimeMessage,
} from "../../lib/messages";
import { MESSAGE_TYPES } from "../../lib/messages";
import {
  CONSENT_STORAGE_KEY,
  PRIVACY_POLICY_URL,
  createConsentRecord,
  hasValidConsent,
} from "../../lib/privacy/consent";
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
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [consented, setConsented] = useState(false);
  const [session, setSession] = useState<ScanSession>();
  const [result, setResult] = useState<AnalysisResult>();
  const [showingDemo, setShowingDemo] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("standard");
  const [activeUrl, setActiveUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<CaptureProgress>();
  const [exporting, setExporting] = useState<"pdf" | "xls">();
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [privacyNotice, setPrivacyNotice] = useState<string>();

  useEffect(() => {
    void chrome.storage.local.get(CONSENT_STORAGE_KEY).then((stored) => {
      setConsented(hasValidConsent(stored[CONSENT_STORAGE_KEY]));
      setConsentLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!consented) return;

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
  }, [consented]);

  async function acceptDisclosure() {
    await chrome.storage.local.set({
      [CONSENT_STORAGE_KEY]: createConsentRecord(),
    });
    setConsented(true);
    setPrivacyNotice(undefined);
  }

  async function openPrivacyPolicy() {
    await chrome.tabs.create({ url: PRIVACY_POLICY_URL });
  }

  async function deleteLocalData() {
    if (collecting) {
      await sendToActiveTab({ type: MESSAGE_TYPES.cancelCollection }).catch(
        () => undefined,
      );
    }
    await chrome.storage.local.clear();
    setSession(undefined);
    setResult(undefined);
    setShowingDemo(false);
    setCollecting(false);
    setCaptureProgress(undefined);
    setActiveUrl(undefined);
    setError(undefined);
    setConfirmingDeletion(false);
    setPrivacyNotice("Local extension data deleted.");
    setConsented(false);
  }

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
    setCollecting(false);
    setCaptureProgress(undefined);
  }

  async function skipCurrentPost() {
    if (!session || !activeUrl) return;

    if (collecting) {
      await sendToActiveTab({ type: MESSAGE_TYPES.cancelCollection }).catch(
        () => undefined,
      );
    }

    const nextSession = skipPost(session, activeUrl);
    const followingPostUrl = getNextPostUrl(nextSession);
    setSession(nextSession);
    setError(undefined);
    setCollecting(false);
    setCaptureProgress(undefined);
    await saveSession(nextSession);

    const tab = await getActiveTab();
    if (followingPostUrl && tab?.id) {
      await chrome.tabs.update(tab.id, { url: followingPostUrl });
      setActiveUrl(followingPostUrl);
    }
  }

  async function startPassiveCollection() {
    if (!session) return;
    setWorking(true);
    setError(undefined);
    setCaptureProgress(undefined);

    try {
      const config = getScanModeConfig(session.mode);
      const response = await sendToActiveTab({
        type: MESSAGE_TYPES.startCollection,
        postUrl: activeUrl,
        maxComments: config.commentLimit,
      });
      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "collection") {
        throw new Error("Expected collection status.");
      }
      setCaptureProgress({
        type: MESSAGE_TYPES.captureProgress,
        postId: "current",
        collected: response.collected,
        target: response.target,
        status:
          response.collected >= response.target ? "ready" : "collecting",
      });
      setCollecting(true);
    } catch (captureError) {
      setError(
        captureError instanceof Error
          ? captureError.message
          : "Unable to start passive collection.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function savePassiveCollection() {
    if (!session) return;
    setWorking(true);
    setError(undefined);

    try {
      const response = await sendToActiveTab({
        type: MESSAGE_TYPES.finishCollection,
      });
      if (!response.ok) throw new Error(response.error);
      if (response.kind !== "post") throw new Error("Expected post data.");
      if (response.post.comments.length === 0) {
        throw new Error(
          "No visible comments found. Expand the comments on this post, wait for them to load, then try again.",
        );
      }

      const nextSession = addCapturedPost(session, response.post);
      const followingPostUrl = getNextPostUrl(nextSession);
      setSession(nextSession);
      await saveSession(nextSession);
      setCollecting(false);
      setCaptureProgress(undefined);

      const tab = await getActiveTab();
      if (followingPostUrl && tab?.id) {
        await chrome.tabs.update(tab.id, { url: followingPostUrl });
        setActiveUrl(followingPostUrl);
      }
    } catch (captureError) {
      setError(
        captureError instanceof Error ? captureError.message : "Capture failed.",
      );
    } finally {
      setWorking(false);
    }
  }

  async function cancelPassiveCollection() {
    await sendToActiveTab({ type: MESSAGE_TYPES.cancelCollection }).catch(
      () => undefined,
    );
    setCollecting(false);
    setCaptureProgress(undefined);
    setError(undefined);
  }

  async function finishScan() {
    if (!session) return;
    if (collecting) {
      await sendToActiveTab({ type: MESSAGE_TYPES.cancelCollection }).catch(
        () => undefined,
      );
      setCollecting(false);
      setCaptureProgress(undefined);
    }
    const sample = buildProfileSample(session);
    const historyKey = profileHistoryKey(sample.handle);
    const stored = await chrome.storage.local.get(historyKey);
    const history = Array.isArray(stored[historyKey])
      ? (stored[historyKey] as ProfileHistorySnapshot[])
      : [];
    const analysis = analyzeProfile(sample, history);
    const nextHistory = appendHistorySnapshot(history, sample);
    setResult(analysis);
    await chrome.storage.local.set({
      [`scan:${analysis.handle}`]: analysis,
      [historyKey]: nextHistory,
    });
    setSession(undefined);
    await saveSession(undefined);
  }

  async function cancelScan() {
    if (collecting) {
      await sendToActiveTab({ type: MESSAGE_TYPES.cancelCollection }).catch(
        () => undefined,
      );
    }
    setSession(undefined);
    setResult(undefined);
    setError(undefined);
    setShowingDemo(false);
    setCollecting(false);
    setCaptureProgress(undefined);
    await saveSession(undefined);
  }

  async function exportReport(format: "pdf" | "xls") {
    if (!result) return;
    setExporting(format);
    setError(undefined);

    try {
      if (format === "pdf") {
        await exportAnalysisPdf(result);
      } else {
        exportAnalysisXls(result);
      }
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : `Unable to create the ${format.toUpperCase()} report.`,
      );
    } finally {
      setExporting(undefined);
    }
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
        <div className="mask" aria-hidden="true">
          <img src="/icon/48.png" alt="" />
        </div>
        <div>
          <p className="eyebrow">ENGAGEMENT X-RAY</p>
          <h1>Creator Trust Lens</h1>
        </div>
      </header>

      {!consentLoaded && (
        <section className="empty-card status-card" aria-live="polite">
          <p>Loading privacy choices…</p>
        </section>
      )}

      {consentLoaded && !consented && (
        <section className="empty-card disclosure-card">
          <p className="eyebrow">YOUR DATA STAYS LOCAL</p>
          <h2>Review before continuing.</h2>
          <p>
            After you start a scan, Creator Trust Lens reads publicly visible
            Instagram profile, post, and comment content from the active tab.
          </p>
          <ul className="disclosure-list">
            <li>Analysis runs locally in this browser.</li>
            <li>Scan results and lightweight history are saved in Chrome local storage.</li>
            <li>Nothing is sent to us or sold to third parties.</li>
            <li>You can delete all locally stored extension data at any time.</li>
          </ul>
          <button onClick={() => void acceptDisclosure()} type="button">
            I UNDERSTAND, CONTINUE
          </button>
          <button
            className="demo-button"
            onClick={() => void openPrivacyPolicy()}
            type="button"
          >
            READ PRIVACY NOTICE
          </button>
          {privacyNotice && <p className="success">{privacyNotice}</p>}
        </section>
      )}

      {consented && !session && !result && (
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
                  <span>{config.postLimit} post target · {config.commentLimit} comments each</span>
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

      {consented && session && (
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
              <strong>{collecting ? "Passive collection active" : "Post ready to collect"}</strong>
              <p>
                {collecting
                  ? "Open the full comments list and scroll it manually. Creator Trust Lens observes visible comments without clicking or scrolling Instagram."
                  : `Start the passive collector, then manually scroll toward the ${activeModeConfig.commentLimit}-comment target. You can save a partial sample at any time.`}
              </p>
              {collecting && captureProgress && (
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
                  <small>
                    {captureProgress.status === "ready"
                      ? "Target reached. Save this sample."
                      : "Keep scrolling Instagram comments manually."}
                  </small>
                </div>
              )}
              {collecting ? (
                <button
                  onClick={savePassiveCollection}
                  disabled={working || !captureProgress?.collected}
                >
                  {working
                    ? "SAVING SAMPLE…"
                    : captureProgress?.status === "ready"
                      ? "SAVE COLLECTED SAMPLE"
                      : `SAVE PARTIAL ${captureProgress?.collected ?? 0}/${captureProgress?.target ?? activeModeConfig.commentLimit}`}
                </button>
              ) : (
                <button onClick={startPassiveCollection} disabled={working}>
                  {working ? "STARTING…" : "START PASSIVE COLLECTION"}
                </button>
              )}
              {collecting && (
                <button className="text-button" onClick={cancelPassiveCollection}>
                  Stop collection
                </button>
              )}
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

      {consented && result && (
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
            {(result.sampleCoverage !== undefined || result.historySnapshots) && (
              <p className="sample reliability-summary">
                {result.sampleCoverage !== undefined
                  ? `${Math.round(result.sampleCoverage * 100)}% sample target coverage`
                  : "Legacy sample"}
                {result.historySnapshots
                  ? ` · ${result.historySnapshots} earlier scan${result.historySnapshots === 1 ? "" : "s"} available`
                  : " · First historical snapshot"}
              </p>
            )}
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

          <section className="export-card">
            <div>
              <p className="eyebrow">KEEP OR SHARE THE EVIDENCE</p>
              <h2>Export this analysis</h2>
              <p>Reports are generated locally in your browser.</p>
            </div>
            <div className="export-actions">
              <button
                className="export-pdf"
                onClick={() => void exportReport("pdf")}
                disabled={Boolean(exporting)}
              >
                {exporting === "pdf" ? "CREATING PDF…" : "EXPORT PDF"}
              </button>
              <button
                className="export-xls"
                onClick={() => void exportReport("xls")}
                disabled={Boolean(exporting)}
              >
                {exporting === "xls" ? "CREATING XLS…" : "EXPORT XLS"}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
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

      {consented && (
        <section className="privacy-controls">
          {confirmingDeletion ? (
            <div className="delete-confirmation">
              <strong>Delete all local data?</strong>
              <p>This removes saved scans, scan history, and your consent choice.</p>
              <div>
                <button className="danger-button" onClick={() => void deleteLocalData()}>
                  DELETE EVERYTHING
                </button>
                <button className="text-button" onClick={() => setConfirmingDeletion(false)}>
                  Keep my data
                </button>
              </div>
            </div>
          ) : (
            <div className="privacy-links">
              <button className="footer-button" onClick={() => void openPrivacyPolicy()}>
                Privacy
              </button>
              <span aria-hidden="true">·</span>
              <button className="footer-button" onClick={() => setConfirmingDeletion(true)}>
                Delete local data
              </button>
            </div>
          )}
        </section>
      )}

      <footer>Analysis shows observable signals, not proof.</footer>
    </main>
  );
}
