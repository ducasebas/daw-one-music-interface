# Publication review — 3 November 2026

Decision updated after owner approval: **MIT source licence selected and supplied-image public redistribution approved on 3 November 2026**. Repository visibility remains private until the owner changes it; audit limitations below still apply. Private repository maintenance is authorised; changing visibility and publishing private correspondence are separate actions. No email has been sent by this review.

## Scope inspected

Starting GitHub head: `9052ed6824f4aa350bbaf454d862807e9ee54ff8`. The main branch lists 32 commits back to a root commit, 112 current files and 329 changed-file records. Reviewed current source/config/docs and all available text commit diffs with targeted patterns for private keys, GitHub/cloud tokens, JWTs, credential assignments and private network addresses. Author metadata uses GitHub noreply addresses. One branch (`main`) and no releases were returned. The tag namespace lookup returned 404; do not interpret that as a comprehensive review of hidden/unreachable refs.

Most local files matched remote Git blob hashes. Two stale local documents were refreshed from GitHub before editing. Four text design/evaluation documents were reviewed through the connector. The six reference JPGs, font, startup images and videos were inventoried; binary content, embedded metadata and redistribution rights were not exhaustively scanned. Local attachment uploads, ignored `.env`/archives, installed Pi files, account secrets, backups, collaborators' clones and personal mailboxes are outside this review. This is a bounded heuristic review, not a guarantee that no secret exists.

## Findings and action

| Finding | Action / remaining decision |
| --- | --- |
| No real access token, private key or password identified in inspected text/diffs | Keep credentials outside Git; do not treat absence of pattern matches as proof |
| An internal MA IP appeared in a URL regression test | Current test uses reserved documentation address `192.0.2.10`; the old address remains in commit history. It is network metadata, not a credential. No history rewrite performed |
| Source licence | Owner approved MIT; LICENSE and package metadata added |
| Reference/startup asset rights | Owner confirmed public redistribution permission; separately licensed elements retain their terms. See THIRD_PARTY_NOTICES.md |
| Latest five Actions runs failed before browser checks | Root cause: Node 22 rejected `--test-isolation=none`. Removed that unnecessary flag and added a Node 22/24 matrix; the 3 November run passed on Node 22 and 24 |
| npm audit reported one high-severity body-parser advisory | Updated the compatible dependency lock without force; repeat audit and tests recorded separately |
| README/outreach described only VM/mock playback | Added owner-reported Pi/MA/Squeezelite evidence, with unresolved problems and no HAT certification |
| HTTP player API has no application authentication | Production defaults to loopback. Keep private forwarding/SSH; do not run an Internet-facing live-control demo |
| Free-hardware programme not independently verified | Request consideration for a sample, not entitlement; verify the actual policy/link |

The previously shared personal correspondence is not committed verbatim. Do not add token-bearing terminal output or personal server/MAC identifiers to public reports. If a credential was ever committed elsewhere, revoke it before considering history cleanup.

## What is still missing

A current simulated Now Playing screenshot is included in the README; it is not proof of real audio or hardware safety. Source licence and owner asset permission are now recorded. For a credible sample request, provide an accessible demonstration, a concise product explanation and a bounded proposal that benefits other hobbyists. A polished video is useful but not a prerequisite. The existing private repository link alone is inaccessible to an unauthorised recipient.

For the product: live library/search/recommendations/artwork/queue editing (current example sections are not connected), reproducible Squeezelite service/recovery, stable power, Pi graphics profiling, track-change and multiroom endurance/sync measurements, final DSI/touch, actual HAT audio, revision-specific standby/mute integration, controller firmware, button/LED/sensors, power sequencing and independent electrical safety. The project is an early prototype, not a completed amplifier.

## Publication steps after corrections

1. Review the private changes and final CI result.
2. Completed: owner approved MIT and public redistribution of supplied images; keep third-party notices.
3. Decide whether the remaining historical private-IP metadata is acceptable. Removing it from the latest file does not erase history. No blanket history rewrite is recommended without a concrete need.
4. Review README, screenshots/demo, branches, releases, Actions artifacts/logs and GitHub account security settings for public suitability. Enable private vulnerability reporting/secret scanning where available.
5. The owner can change Settings → General → Danger Zone → Change repository visibility after approval. The currently available GitHub connector does not provide a repository-visibility mutation tool.
6. Update the outreach text to the real public/licensed state and send the reviewed email personally.

No shipping address, full private email thread or account credential is required in the public repository. Any eventual sample/shipping arrangement belongs in private correspondence.
