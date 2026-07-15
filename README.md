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
3. Open each post from the side panel and choose **Load and capture sample**.
4. The extension loads comment batches with a fixed attempt limit and captures up to 150 visible comments. Nothing is collected until you click.
5. Finish at any point to calculate a trust score, confidence level, and evidence cards from the combined sample.

The score is withheld when the sample is too small. Instagram markup changes frequently, so the platform adapter is intentionally isolated from the analysis engine.

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
