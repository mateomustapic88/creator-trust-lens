# Chrome Web Store listing draft

## Listing details

**Name:** Creator Trust Lens

**Summary:** Review public Instagram engagement signals with transparent evidence, confidence levels, and local-only analysis.

**Category:** Productivity

**Language:** English

**Visibility for private beta:** Unlisted

## Detailed description

Creator Trust Lens helps brands, agencies, and marketing teams review observable engagement signals on public Instagram profiles before working with a creator.

Start a guided scan from an Instagram profile, manually load the comments you want to include, and receive an evidence-led trust score with a clearly stated confidence level. The report highlights repeated comments, low-information replies, recurring commenter groups, audience diversity, engagement variation, comment-to-like balance, sample completeness, and available historical changes.

The score is a screening aid, not a fraud verdict. Creator Trust Lens does not label creators as fake and does not claim to prove how engagement was obtained. Smaller or incomplete samples receive lower confidence, and a score is withheld when evidence is insufficient.

Key features:

- Quick, Standard, and Deep guided scan targets
- Passive collection while you manually scroll visible comments
- Evidence cards with examples and plain-language explanations
- Confidence and sample-coverage indicators
- Age-normalized and media-aware engagement comparisons
- Bounded local history for repeat scans
- Branded PDF and Excel-compatible XLS exports
- Local browser processing with no Creator Trust Lens account
- One-click deletion of all extension-local data

Current scope: public Instagram profiles in Chrome on desktop. Instagram markup can change, so collection availability may vary by page and account state.

## Single purpose

Creator Trust Lens reviews publicly visible Instagram engagement signals and presents the evidence, sample quality, and confidence behind a creator-screening score.

## Permission justifications

**activeTab:** Used to identify the Instagram page the user is actively viewing, send a user-requested scan or collection command to that tab, and navigate the same tab through the guided post queue. It is not used for background browsing surveillance.

**sidePanel:** Used to show the scan workflow and report beside Instagram while the user manually reviews and scrolls the selected content.

**storage:** Used to save the consent record, active scan progress, completed analysis, preferences, and up to 12 lightweight historical snapshots per scanned profile on the user's device.

**Host access to `https://www.instagram.com/*`:** Required for the content script to parse public profile, post, metric, and comment content when the user explicitly starts a scan. The extension does not bypass private accounts or access controls.

## Privacy form guidance

Use conservative disclosure. The extension handles data locally even though it does not transmit it off the device.

Declare the applicable categories for:

- personally identifiable information, because public Instagram handles are identifiers;
- website content, because public profile, post, metric, and comment content is read;
- web history or browsing activity if the dashboard category includes active Instagram URLs and the locally saved post URLs; and
- user activity if the dashboard wording covers the user's scan actions or interaction with the active Instagram page.

State that data is used for core functionality, is not sold, is not used for advertising or credit decisions, and is not transmitted outside the user's device. Confirm the Limited Use certification only while the implementation continues to match the privacy notice.

**Privacy policy URL:** https://github.com/mateomustapic88/creator-trust-lens/blob/main/PRIVACY.md

**Support URL:** https://github.com/mateomustapic88/creator-trust-lens/issues

## Assets

- Icon: `public/icon/128.png`
- Screenshot: `store-assets/generated/screenshot-report-1280x800.png`
- Small promotional tile: `store-assets/generated/small-promo-440x280.jpg`
- Marquee promotional tile: `store-assets/generated/marquee-promo-1400x560.jpg`

The screenshot uses sample data and accurately represents the extension report interface.
