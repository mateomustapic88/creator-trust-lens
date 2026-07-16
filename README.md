# Creator Trust Lens

Creator Trust Lens is an evidence-first Chrome extension concept for reviewing public Instagram engagement. It highlights observable patterns such as repeated comments, low-information comments, recurring commenter groups, and unusual engagement variation.

It does **not** claim to prove that a creator purchased followers or engagement. Results are presented as signals with a sample size and confidence level.

## Initial scope

- Instagram desktop profiles only
- User-triggered scans only
- Publicly visible profile and post data only
- Local analysis and local storage
- No account, backend, paid API, or automatic bulk collection

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
Instagram removes it from the DOM while the user scrolls.
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

The report combines repeated and low-information comments, recurring accounts,
audience diversity, and engagement variation. These remain observable signals,
not conclusions about how engagement was obtained.

## Demo workflow

Click **View sample report** in the side panel to present a clearly labelled,
prebuilt report without visiting Instagram. The sample runs through the same
local analysis engine as a real guided scan and is never saved as a real scan.

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

The MVP analyses data locally. See [PRIVACY.md](./PRIVACY.md) for the initial disclosure.
