# EOSMusic — device QA checklist (iPhone 12 / A14 baseline)

Pass criteria: scroll ≥55 FPS, no hitch >16 ms, stream start <2 s when job ready, recovery without position loss, stable artwork memory.

## Playback / stream
- [ ] Play EOS catalog track (cold job) — starts or clear error <60 s
- [ ] Mid-track Wi‑Fi → LTE / short loss — recovers, position ±2 s, spinner shows buffering
- [ ] Two stalls same track — recovers up to policy max (not hard-stop on 2nd)
- [ ] Skip next while another download active — playback OK, prefetch deferred
- [ ] WebDAV QNAP track — streams without full RAM download
- [ ] Google Drive large file — downloads to temp (not memory), then plays
- [ ] Background + lock screen controls for 10 min

## Downloads
- [ ] Single download shows real % (not stuck at 55)
- [ ] Cancel mid-download restores `.onServer` when applicable; no orphan `.part`
- [ ] Two parallel downloads max; third queues
- [ ] Album bulk acquire: bounded retries, no infinite loop
- [ ] Share-from-server path uses download service (concurrency + progress)

## UI / heat
- [ ] Scroll **Utwory** while playing + mini player — fluid, cooler than before
- [ ] Spectrum 32/64 full player 5 min — stays usable, Auto Performance throttles when warm
- [ ] Artwork fling 500 rows — no main-thread stalls, cache hits on revisit
- [ ] Theme change does not remount entire app tree

## Video
- [ ] Open/close video repeatedly — no security-scope leak (scopes cleared)
- [ ] Scrub filmstrip ≤20 thumbs, memory drops after dismiss

## Instruments (optional)
Time Profiler, SwiftUI, Core Animation, Allocations, Network, Energy Log on physical iPhone 12+.
