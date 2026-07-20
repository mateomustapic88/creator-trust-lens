# Creator Trust Lens Privacy Notice

Effective date: July 20, 2026

Creator Trust Lens is a Chrome extension that helps a user review observable engagement signals on public Instagram profiles. It does not determine whether a creator purchased followers or engagement.

## Data the extension handles

Only after the user accepts the in-product disclosure and starts a scan, Creator Trust Lens may read the following publicly visible content from the active Instagram tab:

- creator and commenter usernames;
- profile and post URLs;
- public follower, like, and comment counts when visible;
- post identifiers, format, and publication time when visible; and
- the text of comments the user manually brings into view.

The extension also stores the user's consent choice, active scan state, completed analysis results, monthly Free-plan usage, and preferences needed to operate the extension. If the user opens billing or restores a purchase, ExtensionPay may process an email address, license status, plan, and subscription status. Stripe processes payment details during checkout. Creator Trust Lens does not receive or store full card details.

## Why this data is used

This data is used only to provide the user-facing features of Creator Trust Lens: guided collection, engagement-signal analysis, confidence calculation, plan enforcement, historical comparison, and local PDF or XLS report export.

## Local processing and storage

Analysis and report generation happen locally in the user's browser. Creator Trust Lens has no application server and does not transmit scanned Instagram content, browsing data, analysis results, or exported reports to the developer, ExtensionPay, Stripe, or any other third party.

After consent, the extension contacts ExtensionPay to validate Free or Pro access. If the user chooses to upgrade, restore a purchase, or manage a subscription, the extension opens ExtensionPay pages. ExtensionPay and Stripe process the billing and account information needed for those actions under their own privacy terms.

Active scan data may temporarily contain captured comment text and commenter usernames. When a scan is completed or cancelled, the active session is removed. A completed result may retain short evidence examples that appear in the report.

For historical comparisons, the extension keeps up to 12 lightweight snapshots for each scanned profile. These snapshots contain the public profile handle, scan time, follower count, post URL or identifier, media type, publication time, and visible engagement totals. Historical snapshots do not copy captured comment text.

Scan content, results, usage quota, preferences, and history are stored with `chrome.storage.local` on the user's device until the user deletes them or uninstalls the extension. ExtensionPay may store its API key and cached license record with `chrome.storage.sync`, which Chrome can sync within the user's signed-in browser profile. The **Delete local data** control clears both storage areas for this extension.

## Sharing and selling

Creator Trust Lens does not sell or rent user data or scanned website content. Billing and licensing information is transferred only to ExtensionPay and Stripe as needed to provide optional paid features. Scanned Instagram content and analysis results are never transferred to them. Data is not used for advertising, credit decisions, or purposes unrelated to the extension's single purpose.

## User control and deletion

The side panel includes a **Delete local data** control. It removes saved scans, scan history, active session data, local usage quota, local billing login data, preferences, and the consent record. Uninstalling the extension also removes extension-local data according to Chrome's normal behavior.

Deleting local data does not cancel a paid subscription or delete records held by ExtensionPay or Stripe. Users can manage a subscription from the extension's Pro controls and contact the support address on the store listing for account or billing deletion requests.

Reports exported by the user are ordinary files controlled by that user. Deleting extension data does not delete files that the user previously exported.

## Permissions

- `activeTab` lets the extension identify and communicate with the Instagram tab the user is actively using.
- `sidePanel` provides the extension interface alongside the active page.
- `storage` keeps consent, scan state, results, Free-plan usage, ExtensionPay access state, and bounded Pro history locally.
- Access to `https://www.instagram.com/*` lets the user start scans on public Instagram profile and post pages.

## Limited use

Creator Trust Lens uses data obtained through Chrome extension capabilities only to provide and improve its prominent user-facing engagement-review features. Its use and transfer of information complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Changes and contact

This notice will be updated before any analytics, crash reporting, cloud sync, or other external service is introduced. Material changes will be presented in the product when renewed consent is appropriate.

Questions or privacy requests can be sent to the verified support email shown on the Creator Trust Lens Chrome Web Store listing.
