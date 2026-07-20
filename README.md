# Creator Trust Lens

Creator Trust Lens is an evidence-first Chrome extension concept for reviewing public Instagram engagement. It highlights observable patterns such as repeated comments, low-information comments, recurring commenter groups, and unusual engagement variation.

It does **not** claim to prove that a creator purchased followers or engagement. Results are presented as signals with a sample size and confidence level.

## Initial scope

- Instagram desktop profiles only
- User-triggered scans only
- Publicly visible profile and post data only
- Local analysis and local storage
- No Creator Trust Lens backend, paid Instagram API, or automatic bulk collection

## Guided scan workflow

1. Open a public Instagram profile and start a guided scan.
2. Creator Trust Lens discovers up to 12 currently visible post links.
3. Open each post from the side panel and choose **Start passive collection**.
4. Open the full comments list and scroll it manually. The extension observes
   DOM changes and accumulates unique comments across virtualized windows, but
   never clicks, scrolls, or generates Instagram activity itself.
5. Save a partial sample at any time, or continue scrolling until the selected
   mode target is reached. Saving automatically opens the next queued post.
6. Finish at any time after capturing at least one post. Smaller samples receive
   lower confidence, and scores are withheld when evidence is insufficient.

Scan modes define recommended evidence targets, not mandatory quotas.

Instagram comment dialogs use virtualized infinite scrolling. The passive
collector watches the active dialog and saves every rendered window before
Instagram removes it from the DOM while the user scrolls. GIF-only reactions
are excluded from captured comment totals and analysis.
Sessions created by older collector versions are discarded to prevent partial
legacy captures from entering a new report.

Reel URL variants are matched by media ID rather than their full URL. A post or
reel that is unavailable, has comments disabled, or cannot be parsed can be
skipped without blocking the remaining scan queue.

The score is withheld when the sample is too small. Instagram markup changes frequently, so the platform adapter is intentionally isolated from the analysis engine.

### Scan modes

- **Quick:** 5 posts, up to 50 comments per post
- **Standard:** 8 posts, up to 150 comments per post
- **Deep:** 12 posts, up to 300 comments per post

## Free and Pro access

The Free plan includes 3 completed Quick scans per UTC calendar month and the
full on-screen evidence report. Pro unlocks unlimited Quick, Standard, and Deep
scans, PDF and XLS exports, and bounded historical comparisons. Payments,
purchase restore, and subscription management are provided by ExtensionPay and
Stripe. Instagram scan content never leaves the browser.

The Free quota is intentionally stored locally for the MVP. Clearing extension
data resets it, so it is a product limit rather than tamper-resistant metering.

The report combines repeated and low-information comments, recurring accounts,
audience diversity, sample completeness, age-normalized engagement, media-aware
variation, and comment-to-like balance. Repeat scans also compare follower and
post-engagement changes using a bounded local history. These remain observable
signals, not conclusions about how engagement was obtained.

Fresh posts under 48 hours old are excluded from settled-engagement comparisons.
Reels and regular posts are compared within their own formats where enough data
exists. Incomplete collection targets reduce confidence but do not add risk
points. Missing metrics are excluded from score weighting rather than treated as
positive evidence.

Low and medium confidence scores are pulled toward a neutral result so a limited
sample cannot appear fully verified. Historical snapshots contain follower and
post totals only; comment text is not duplicated into history.

## Report exports

Completed analyses can be exported locally in two formats:

- **PDF:** a branded, shareable Creator Trust Lens report with the trust score,
  confidence, sample size, evidence cards, examples, and context disclaimer.
- **XLS:** an Excel-compatible workbook with separate Summary and Evidence
  worksheets for filtering, review, or importing into an agency workflow.

Neither export sends creator or comment data to a server.

## Demo workflow

Click **View sample report** in the side panel to present a clearly labelled,
prebuilt report without visiting Instagram. The sample runs through the same
local analysis engine as a real guided scan and is never saved as a real scan.

## Consent and local data

The first-run disclosure must be accepted before the extension reads the active
Instagram tab. The side panel links to the privacy notice and provides a
**Delete local data** control that clears consent, active sessions, completed
results, usage quota, billing login state, and bounded history from Chrome local storage.

## Development

```bash
npm install
npm run dev
```

WXT opens a development browser when possible. Alternatively, run `npm run build` and load `.output/chrome-mv3` as an unpacked extension from `chrome://extensions`.

## Checks

```bash
npm run check
```

For a release candidate, run `npm run release:check`. This also audits production
dependencies and creates the Chrome Web Store upload ZIP in `.output`.

Chrome Web Store listing copy, privacy-form guidance, assets, and the manual
submission checklist are in [`docs/chrome-web-store-listing.md`](./docs/chrome-web-store-listing.md)
and [`docs/chrome-web-store-submission-checklist.md`](./docs/chrome-web-store-submission-checklist.md).

## Product language

Use:

- Engagement Trust Score
- Observable signals
- Confidence level
- Review recommended
- Insufficient data

Avoid:

- “This creator is fake”
- “Confirmed fake followers”
- Unsupported claims about purchased engagement

## Privacy

Instagram analysis remains local. Optional billing uses ExtensionPay and Stripe as described in [PRIVACY.md](./PRIVACY.md).
