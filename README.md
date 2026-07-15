# Creator Trust Lens

Creator Trust Lens is an evidence-first Chrome extension concept for reviewing public Instagram engagement. It highlights observable patterns such as repeated comments, low-information comments, recurring commenter groups, and unusual engagement variation.

It does **not** claim to prove that a creator purchased followers or engagement. Results are presented as signals with a sample size and confidence level.

## Initial scope

- Instagram desktop profiles only
- User-triggered scans only
- Publicly visible profile and post data only
- Local analysis and local storage
- No account, backend, paid API, or automatic bulk collection

The first scaffold intentionally scans information already rendered on the current profile page. Post-by-post guided collection comes next, after the extraction approach is tested against real page variations.

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
