# WebCodecs Team Outreach — Movi Player

Goal: Get Movi Player featured by the Chrome WebCodecs team (web.dev case study, Chrome blog post, conference talk, or social mention).

This is a sequenced playbook. Do steps in order. Each step builds credibility for the next.

---

## Why this is realistic

- Chrome DevRel actively looks for real-world WebCodecs implementations beyond the usual "real-time AR camera demos"
- Movi Player has a rare combo: WASM demuxer + WebCodecs + HDR + multi-audio + production-ready
- We're open source, Apache 2.0 — easy for them to reference
- We solve a real cost problem (server-side FFmpeg replacement) — that's the kind of story their blog likes

---

## Sequenced action plan

### Phase 1 — Pre-outreach polish (Day 0)

Before reaching out, make sure passive credibility is bulletproof. Anyone landing on the project from a DevRel link should immediately see WebCodecs front and center.

- [ ] **README.md hero section** — add "Built on WebCodecs + WebAssembly" with badges/links to MDN
- [ ] **Live demo at moviplayer.com** must work 100% on Chrome stable, no console errors
- [ ] **GitHub repo** — pin a "WebCodecs use case" issue with architecture diagram
- [ ] **dev.to write-up published** — needed as a citation link
- [ ] **One short demo GIF** (≤10 sec) showing multi-audio switch or HDR — embed in README
- [ ] **Architecture diagram** — File → WASM demuxer → WebCodecs → Canvas (PNG/SVG in repo)

---

### Phase 2 — File W3C WebCodecs GitHub issue (Day 1)

**Why first**: Spec maintainers (Eugene Zemtsov, Bernard Aboba) read every issue. A technically-grounded issue with real bug reports gets personal engagement. This is the **highest-leverage** opening move because it builds technical credibility before any pitch.

**Repo**: https://github.com/w3c/webcodecs

**Issue title**:
> Use case: open-source browser video player handling HEVC/AV1/MKV via WebCodecs + WASM demuxer

**Issue body template**:

```markdown
Sharing a real-world WebCodecs implementation that might be useful as a reference / use case for the spec.

## Project

**Movi Player** (Apache 2.0) — drop-in <video> replacement
- Plays HEVC, AV1, MKV, 4K HDR, multi-audio, embedded subtitles
- Pipeline: WASM demuxer (FFmpeg) → VideoDecoder/AudioDecoder → Canvas
- Hardware decode with software fallback
- Production: web app, Chrome extension, VS Code extension, npm

**Links**:
- Demo: https://moviplayer.com
- Source: https://github.com/mrujjwalg/movi-player
- Architecture write-up: [dev.to URL]

## Real-world feedback (2–3 specific spec papercuts)

1. [Specific issue 1 — e.g., HEVC `VideoDecoderConfig.description` parsing edge cases]
2. [Specific issue 2 — e.g., color space metadata propagation when frames go through Canvas]
3. [Specific issue 3 — e.g., AudioDecoder behavior with AC-3 / E-AC-3 in multi-track files]

Happy to file separate issues for each, contribute conformance test cases, or help with documentation.
```

**Critical**: The 2–3 feedback points must be **real** problems you hit. Generic "thanks for the API" issues get ignored. Specific bug reports get Eugene Zemtsov to comment within 48h.

**Action items before filing**:
- [ ] Write down 2–3 actual WebCodecs papercuts you hit while building Movi
- [ ] Verify each is reproducible on latest Chrome stable
- [ ] Link to specific lines in your codebase where the workaround lives

---

### Phase 3 — Twitter/X outreach (Day 2)

Post your dev.to article + tag relevant Chrome DevRel + WebCodecs team members.

**Target list** (priority order):

| Handle | Role | Why |
|---|---|---|
| `@_zemtsov` | WebCodecs Chrome lead | Will see GitHub issue too — double signal |
| `@fbeaufort` | Chrome DevRel, web.dev writer | Most likely to write a feature post |
| `@tomayac` (Thomas Steiner) | Chrome DevRel | Web platform writer |
| `@jaffathecake` (Jake Archibald) | Chrome DevRel | HTTP 203 podcast host |
| `@DasSurma` | Ex-Chrome DevRel | Wasm + perf influence |
| `@addyosmani` | Chrome perf lead | High-RT-rate on novel projects |
| `@una` | Chrome DevRel lead | Visibility multiplier |

**Tweet template** (don't tag more than 2 people in one tweet — tag others in replies):

```
Hey @fbeaufort @_zemtsov — built an open-source web video player using WebCodecs + a WASM demuxer that plays HEVC, AV1, MKV, 4K HDR fully client-side.

Drop-in <video> replacement. No server transcoding.

Demo: moviplayer.com
GitHub: github.com/mrujjwalg/movi-player
Write-up: [dev.to link]

Filed a use case issue at w3c/webcodecs with some real-world spec feedback.
```

**Action items**:
- [ ] Draft tweet, attach 1600x900 banner image
- [ ] Verify all links work (demo, GitHub, dev.to)
- [ ] Post during US morning (6–9 AM PT, Tue/Wed/Thu)
- [ ] Reply to thread with 2–3 follow-up tweets tagging remaining people one at a time
- [ ] Pin the tweet for 2 weeks

---

### Phase 4 — web.dev case study email (Day 3)

The official path. Highest payoff if accepted (web.dev articles get ~100K+ views and permanent SEO juice).

**Send to**: `web-dev-case-studies@google.com`
**CC**: François Beaufort, Eugene Zemtsov (find emails on their public Chrome profiles or @ them in Twitter to get attention)

**Subject**:
> Case study pitch: Movi Player — a WebCodecs-based browser video player handling HEVC, AV1, MKV, HDR

**Body**:

```
Hi web.dev team,

I'd like to submit Movi Player for consideration as a WebCodecs case study.

What it is:
Movi Player is an open-source (Apache 2.0) drop-in <video> replacement that uses WebCodecs + WebAssembly to decode HEVC, AV1, MKV, 4K HDR, multi-audio, and embedded subtitles entirely client-side — zero server transcoding.

Why it might interest readers:
1. End-to-end real-world WebCodecs implementation: WASM demuxer (FFmpeg) → VideoDecoder/AudioDecoder → Canvas render pipeline
2. Demonstrates how WebCodecs unlocks codecs the <video> tag can't reach (HEVC/AV1/MKV)
3. Includes BT.2020/PQ/HLG HDR tone-mapping — most web players still fake this
4. Hardware-decode-with-software-fallback strategy with a single clean API surface
5. Shows the cost story: replaces an entire FFmpeg server pipeline with browser primitives
6. Three production surfaces: web app (moviplayer.com), Chrome extension, VS Code extension

Resources:
- Live demo: https://moviplayer.com
- GitHub: https://github.com/mrujjwalg/movi-player
- Technical write-up: [dev.to URL]
- W3C WebCodecs use case issue: [GitHub issue URL from Phase 2]

Happy to write the case study draft, share metrics, or jump on a call. I think this is a strong showcase of "what's actually possible with WebCodecs today" beyond the usual real-time AR demos.

Best,
Ujjawal Kashyap
[email] | [Twitter] | [LinkedIn]
```

**Action items**:
- [ ] Find François Beaufort's public Chrome contact (chromium.org email or @fbeaufort DM)
- [ ] Send email Tuesday morning PT (highest open rate for tech email)
- [ ] Set a 2-week follow-up reminder — if no reply, send one polite nudge

---

### Phase 5 — Show HN (Day 4 — Saturday morning)

Hacker News front page = guaranteed Chrome PM/DevRel attention (they monitor it heavily).

**Title format**:
> Show HN: Movi Player – Play HEVC, AV1, MKV in the browser via WebCodecs

**URL**: https://moviplayer.com (NOT the GitHub link — Show HN prefers live demos)

**First comment** (post within 60 sec of submission):
```
Maker here. Built this because I wanted to test how far WebCodecs has come — turns out, far enough to replace server-side FFmpeg pipelines for most use cases.

Architecture: File → WASM demuxer (FFmpeg compiled to Wasm) → WebCodecs VideoDecoder/AudioDecoder → Canvas.

Things I'd love feedback on:
- HEVC playback edge cases (especially HDR HEVC)
- Multi-audio track switching latency
- Whether the 50KB demuxer-only build is useful for upload validators

Source: https://github.com/mrujjwalg/movi-player
Technical write-up: [dev.to link]
W3C WebCodecs use case I filed: [GitHub issue link]
```

**Action items**:
- [ ] Post Saturday 6–9 AM PT (best HN front-page traction window)
- [ ] First comment within 60 sec
- [ ] Reply to every top-level comment in first 4 hours — comment activity boosts ranking
- [ ] Don't ask for upvotes anywhere (instant flag)

---

### Phase 6 — Web Almanac + conference CFPs (Week 2+)

Lower probability but strong long-term value.

**Web Almanac**:
- Email: `webalmanac@httparchive.org`
- Pitch: "Movi Player as a real-world WebCodecs adoption stat point in the Media chapter"
- They publish annually (usually Q4) — submit early
- [ ] Email submitted

**Chrome Dev Summit / Google I/O Web track**:
- Talk title proposal: *"Inside a WebCodecs-based browser video player: HEVC, HDR, and the end of server-side transcoding"*
- Submit when CFPs open (usually Jan–Feb for Google I/O, varies for CDS)
- [ ] CFP windows tracked

**JSConf / Web Conf India / India FOSS / WebExpo**:
- Same talk, regional reach, often easier to get accepted
- [ ] At least 2 CFPs submitted

**W3C Media WG monthly meeting**:
- Calendar: https://w3c.github.io/webcodecs/
- Show up, demo for 5 min during open discussion
- [ ] Attended at least one meeting

---

### Phase 7 — Build adjacent-influencer credibility (ongoing)

Chrome DevRel watches what these people retweet/share. Their RT is often what makes DevRel notice.

| Person | Channel | Action |
|---|---|---|
| Una Kravets (`@una`) | X | Engage on her web platform tweets |
| Addy Osmani (`@addyosmani`) | X | Reply to his perf tweets with relevant data from Movi |
| Lea Verou (`@LeaVerou`) | X | High-quality replies on web platform threads |
| Steve Sanderson (`@stevensanderson`) | X | Wasm projects — direct overlap |
| Web Platform News | webplatformnews.com | Submit via their form |
| Smashing Magazine | editorial@smashingmagazine.com | Pitch a "Building a WebCodecs player" article |

**Strategy**: Don't cold-pitch them. Engage on their content first for 2–3 weeks. Then mention Movi in a relevant reply. Looks organic, gets noticed.

---

## What NOT to do

- ❌ Cold DM 10 DevRel people in one day with the same message — they share notes
- ❌ Tag more than 2 people in any single tweet (looks desperate)
- ❌ Pitch web.dev without a published write-up + working demo first
- ❌ File spec issues without specific technical feedback (gets ignored)
- ❌ Follow up more than twice — DevRel queues are long, repeat pings get muted
- ❌ Promise custom benchmarks/blog posts before they ask
- ❌ Show HN post that just says "I built X" without a technical hook
- ❌ Submit to web.dev with a broken demo or any console errors

---

## Tracking

Use this table to track progress. Status: `Not started` / `In progress` / `Sent` / `Replied` / `Featured`.

| Channel | Action | Date | Status | Notes |
|---|---|---|---|---|
| W3C WebCodecs GitHub | Use case issue filed | | Not started | |
| Eugene Zemtsov | X mention | | Not started | |
| François Beaufort | X mention | | Not started | |
| web.dev case studies | Email pitch sent | | Not started | |
| Hacker News | Show HN posted | | Not started | |
| Web Almanac | Email pitch sent | | Not started | |
| Google I/O CFP | Talk submitted | | Not started | |
| Chrome Dev Summit | Talk submitted | | Not started | |
| W3C Media WG meeting | Attended + demoed | | Not started | |
| Una Kravets | Engagement started | | Not started | |
| Addy Osmani | Engagement started | | Not started | |
| Smashing Magazine | Article pitch sent | | Not started | |

---

## Success metrics

What "featured" looks like, in increasing order of value:

1. ⭐ Eugene Zemtsov / François Beaufort RT or comment on the project
2. ⭐⭐ Mentioned in a Chrome blog post or web.dev tutorial as an example
3. ⭐⭐⭐ Dedicated web.dev case study published
4. ⭐⭐⭐⭐ Featured in "What's new in Chrome" video by Pete LePage
5. ⭐⭐⭐⭐⭐ Demoed at Google I/O Web keynote (long shot but possible)

Track every mention in this doc as it happens.

---

## Quick reference — key links

- W3C WebCodecs spec repo: https://github.com/w3c/webcodecs
- WebCodecs MDN: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
- web.dev: https://web.dev
- Web Almanac: https://almanac.httparchive.org
- W3C Media WG: https://www.w3.org/groups/wg/media
- Chrome Status: https://chromestatus.com (search "WebCodecs" for related features)
