# Chrome Web Store listing draft

## Listing details

**Name:** Creator Trust Lens: Instagram Review

**Summary:** Review Instagram creators with trust scores, comment analysis, engagement signals, and clear confidence levels.

**Category:** Tools

**Language:** English

**Visibility for private beta:** Unlisted

## Detailed description

Evaluate Instagram creators before a campaign with Creator Trust Lens, a local creator review and influencer vetting tool for brands, agencies, and marketing teams.

Run a guided review from a public creator profile, manually load the comments you want to include, and receive an evidence-led creator trust score with a clearly stated confidence level. The engagement analysis highlights repeated comments, low-information replies, recurring commenter groups, audience diversity, engagement variation, comment-to-like balance, sample completeness, and available historical changes.

Use the report for creator due diligence, influencer screening, and campaign research. The score is a screening aid, not a fraud verdict. Creator Trust Lens does not label creators as fake and does not claim to prove how engagement was obtained. Smaller or incomplete samples receive lower confidence, and a score is withheld when evidence is insufficient.

Key features:

- Quick, Standard, and Deep creator review targets
- Passive collection while you manually scroll visible comments
- Comment-quality and engagement-signal evidence cards
- Confidence and sample-coverage indicators
- Age-normalized and media-aware engagement comparisons
- Bounded local history for repeat scans
- Branded PDF and Excel-compatible XLS exports
- Local browser processing with no Creator Trust Lens account
- One-click deletion of all extension-local data

The Free plan includes 3 completed Quick scans per calendar month and on-screen evidence reports. Creator Trust Lens Pro is an optional paid subscription that unlocks unlimited Quick, Standard, and Deep scans, PDF and XLS exports, and historical comparisons. Available plans and prices are shown before purchase in the secure ExtensionPay checkout.

Current scope: public Instagram creator profiles in Chrome on desktop. Page markup can change, so collection availability may vary by page and account state.

Creator Trust Lens is an independent product and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.

## Single purpose

Creator Trust Lens reviews publicly visible Instagram engagement signals and presents the evidence, sample quality, and confidence behind a creator-screening score.

## Permission justifications

**activeTab:** Used to identify the Instagram page the user is actively viewing, send a user-requested scan or collection command to that tab, and navigate the same tab through the guided post queue. It is not used for background browsing surveillance.

**sidePanel:** Used to show the scan workflow and report beside Instagram while the user manually reviews and scrolls the selected content.

**storage:** Used to save the consent record, active scan progress, completed analysis, monthly Free-plan usage, preferences, and up to 12 lightweight Pro historical snapshots locally. ExtensionPay may use Chrome sync storage for its API key and cached license state so a purchase can be restored across the user's Chrome profile.

**Host access to `https://www.instagram.com/*`:** Required for the content script to parse public profile, post, metric, and comment content when the user explicitly starts a scan. The extension does not bypass private accounts or access controls.

## Privacy form guidance

Use conservative disclosure. The extension handles data locally even though it does not transmit it off the device.

Declare the applicable categories for:

- personally identifiable information, because public Instagram handles are identifiers;
- authentication information, because ExtensionPay may store billing login and license state;
- financial and payment information, because ExtensionPay and Stripe process plan and transaction information when a user voluntarily upgrades;
- website content, because public profile, post, metric, and comment content is read;
- web history, because active Instagram profile and post URLs are processed and may be stored locally during a scan.

State that data is used for core functionality, is not sold, and is not used for advertising or credit decisions. Scanned Instagram content and reports remain local. Optional licensing, login, plan, and payment information is transferred only to ExtensionPay and Stripe to provide paid features. Confirm the Limited Use certification only while the implementation continues to match the privacy notice.

**Privacy policy URL:** https://sites.google.com/view/creator-trust-lens-privacy

Use the verified brand support email configured in the Chrome Web Store dashboard. Do not use the private GitHub repository as a public support URL.

## Assets

- Icon: `public/icon/128.png`
- Screenshot: `store-assets/generated/screenshot-report-1280x800.png`
- Small promotional tile: `store-assets/generated/small-promo-440x280.jpg`
- Marquee promotional tile: `store-assets/generated/marquee-promo-1400x560.jpg`

The screenshot uses sample data and accurately represents the extension report interface.
