# Chrome Web Store submission checklist

## Before upload

- Confirm the privacy-policy URL is publicly accessible in a logged-out browser. The source repository may remain private.
- Confirm the developer dashboard uses Mateo's personal Chrome Web Store account.
- Confirm two-step verification is enabled on that Google account.
- Add and verify a monitored support email in the dashboard.
- Run `npm run release:check`.
- Load `.output/chrome-mv3` as an unpacked extension in a clean Chrome profile.
- Configure ExtensionPay plans for the `creator-trust-lens` project before packaging.
- Test first-run consent, all 3 free Quick scans, the fourth-scan paywall, purchase restore, Pro Standard and Deep modes, PDF export, XLS export, subscription management, and Delete local data.
- Inspect the upload ZIP and confirm that source files, tests, `.git`, and local logs are absent.

## Dashboard

- Upload `.output/creator-trust-lens-0.4.0-chrome.zip` as a new package version.
- Copy the listing text and permission justifications from `docs/chrome-web-store-listing.md`.
- Upload the 1280 by 800 screenshot and 440 by 280 promotional tile.
- Select Productivity and English.
- Complete the Privacy tab conservatively and provide the public privacy-policy URL.
- Disclose the optional paid Pro plan and the ExtensionPay/Stripe billing transfer described in the listing draft.
- Set visibility to **Unlisted** for the private beta.
- Add the support URL and verified support email.
- Save each dashboard section and resolve every warning before submission.

## After submission

- Record the item ID and dashboard status.
- Do not promise testers a release date until review is complete.
- When approved, share the unlisted store link only with selected beta users.
- Collect feedback on collection reliability, report clarity, false-positive risk, and willingness to pay.
- Keep the listing Unlisted until reliability has been validated with real agency workflows.

## User actions still required

The developer must personally complete the Chrome Web Store dashboard declarations and submit the item. These declarations are account-specific legal and privacy attestations and should not be automated or guessed.
