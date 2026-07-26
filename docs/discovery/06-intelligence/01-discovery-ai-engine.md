# EstateOS™ Discovery™ — Silnik AI (Discovery Engine Architecture)

**Status dokumentu:** REVIEW  
**Wersja:** 1.0  
**Ostatnia aktualizacja:** 2026-07-25  
**Właściciel merytoryczny:** Senior AI Architect · Machine Learning Engineer · Data Scientist · Behavioural Psychologist · Product Owner  
**Zależności:** Manifest, Product Principles, UX Principles, User Journey, Screen Flow  
**Klasyfikacja:** architektura inteligencji · algorytmy · struktury danych · **nie kod produkcyjny** · **nie proste filtry**  
**Zakaz:** SQL DDL, endpointy HTTP, biblioteki ML, „WHERE price < X” jako serce systemu

---

## 0. Teza nadrzędna

Discovery™ **nie rankinguje ogłoszeń filtrami katalogowymi**.  
Rankinguje **spotkania człowieka z miejscem** na podstawie:

1. ujawnionego gustu (zachowanie),  
2. reprezentacji miejsc w przestrzeni smaku,  
3. eksploracji z szacunkiem,  
4. wyjaśnialności i kontroli użytkownika.

**Filtry deklaratywne** (cena od–do, checkbox dzielnic) mogą istnieć poza Discovery w innych powierzchniach EstateOS. W silniku Discovery są co najwyżej **miękkimi priorami / hipotezami**, nigdy twardym gatesetem „nie pokaż jeśli…”.

---

## 1. Mapa komponentów silnika

```text
┌─────────────────────────────────────────────────────────────┐
│                     DISCOVERY ENGINE                         │
│  orchestracja: cold-start → score → rank → explore → serve   │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
        ┌───────▼────────┐            ┌───────▼────────┐
        │ Behaviour      │            │ Smart Gallery  │
        │ Engine         │            │ Engine         │
        └───────┬────────┘            └───────┬────────┘
                │                             │
        ┌───────▼────────┐            ┌───────▼────────┐
        │ Taste Vector   │◄──blend───►│ Preference     │
        │ (ujawniony)    │            │ Vector (prior) │
        └───────┬────────┘            └───────────────┘
                │
        ┌───────▼────────┐
        │ Discovery Score│──► ranked candidates + reasons
        └───────┬────────┘
                │
        ┌───────▼────────┐     ┌──────────────────┐
        │ Adaptive       │────►│ Explainable AI   │
        │ Learning       │     │ (reason graph)   │
        └────────────────┘     └──────────────────┘

Cross-cutting: Discovery DNA (tożsamość + constraints moralne modelu)
```

---

## 2. Discovery DNA

### 2.1 Definicja

**Discovery DNA** to niezmienny kontrakt inteligencji: reguły, których model **nie wolno** złamać nawet gdy poprawiają krótkoterminowe metryki.

### 2.2 Chromosomy DNA (constraints)

| ID | Constraint | Algorytmiczne znaczenie |
|----|------------|-------------------------|
| DNA-01 | Behaviour > empty declaration | Waga sygnału behawioralnego ≥ wagi prioru deklaratywnego przy konflikcie |
| DNA-02 | No hard filter gate | Kandydat nie jest usuwany wyłącznie przez deklaratywny próg; może być silnie down-weight |
| DNA-03 | Explainability required for high score | Jeśli `score ≥ τ_explain`, musi istnieć ≥1 human reason |
| DNA-04 | User correction absolute | Korekta „to nie ja” natychmiast obniża odpowiednie wymiary / boosty |
| DNA-05 | Visit feedback dominates gesture | Waga `VISIT_*` > waga `LIKE/DISLIKE` dla tego samego `place_id` |
| DNA-06 | Anti-compulsion | Zakaz optymalizacji pod max decisions/session |
| DNA-07 | Exploration floor | Minimalny udział eksploracji `ε_min` w talii |
| DNA-08 | Fairness monitor | Zakaz trwałego twardego banu lokalizacji po jednym geście |
| DNA-09 | Dignity of not-knowing | Cold start nie wymaga Preference Vector kompletnego |
| DNA-10 | Phase end | Gdy `search_phase=completed`, silnik nie forsujący nowych kart |

### 2.3 Struktura danych DNA

```text
DiscoveryDNA {
  version: semver
  constraints: Constraint[]
  scoring_ Caps: {
    max_single_feature_contribution: float
    min_exploration_ratio: float
    max_echo_chamber_index: float
  }
  ethical_weights: {
    visit_over_gesture: float > 1
    correction_multiplier: float > 1
  }
}
```

---

## 3. Struktury danych — Place Representation

Miejsce (oferta) w silniku to **wektor cech + media semantics**, nie wiersz filtra.

```text
PlaceID: opaque_id

PlaceFeatures {
  place_id: PlaceID
  geo: { city_emb, district_emb, lat, lng }      // embeddingi, nie tylko string
  economics: { price_pln, price_per_m2, tx_type } // ciągłe
  space: { area_m2, rooms, floor_rel }           // ciągłe / relatywne
  amenities_soft: sparse_vector                  // balkon, parking… jako wymiary
  quality_proxies: { media_count, media_diversity, text_richness }
  temporal: { days_on_market, freshness }
  embedding_visual: float[D_v]                   // z reprezentacji zdjęć (offline)
  embedding_text: float[D_t]                     // tytuł/opis (offline)
  embedding_place: float[D_p]                    // fusion visual+text+tabular
}

PlaceMediaSequence {
  place_id
  ordered_assets: Asset[]   // kolejność Smart Gallery
  asset_scores: { aesthetic, layout_clarity, light_proxy, redundancy }
}
```

**Zasada:** tabularne cechy wchodzą do scoringu przez **funkcje podobieństwa / afiliacji**, nie przez `if price > max: drop`.

---

## 4. Taste Vector (wektor smaku ujawnionego)

### 4.1 Definicja

**Taste Vector (TV)** = reprezentacja tego, na co użytkownik **faktycznie reaguje** w przestrzeni miejsc.  
Budowany wyłącznie (lub dominująco) z Behaviour Engine.

### 4.2 Struktura

```text
TasteVector {
  user_id: UserID | GuestID
  version: int
  updated_at: timestamp

  // Główna reprezentacja w przestrzeni miejsc
  mu: float[D_p]              // centroid polubień / atraktor
  sigma: float[D_p]           // niepewność wymiarowa (wysoka = cold / konflikt)
  
  // Afiliacje jawne (agregaty, nie hard filters)
  affinity: {
    city: Map<string, float>           // może być ujemna
    district: Map<string, float>
    property_type: Map<string, float>
    tx_type: Map<string, float>
  }

  // Ekonomia ujawniona (rozkład, nie „max”)
  price: {
    liked_moments: float[]    // rolling
    disliked_moments: float[]
    mu_like: float | null
    mu_dislike: float | null
    elasticity: float         // jak bardzo przekracza „teorię budżetu”
  }

  space: {
    mu_area_like: float | null
    mu_rooms_like: float | null
  }

  // Emocjonalne / behawioralne meta
  tempo: { median_decision_ms, hesitation_rate }
  contradiction_index: float  // 0..1
  confidence: float           // 0..1 global
  exploration_hunger: float   // rośnie gdy echo chamber
}
```

### 4.3 Aktualizacja TV (algorytm Online Taste Update)

Wejście: zdarzenie `e` + `PlaceFeatures(p)`

```text
algorithm UpdateTasteVector(TV, e, p, DNA):
  w = eventWeight(e, DNA)           // LIKE=1, PRIORITY=1.6, DISLIKE=-1,
                                    // VISIT_YES=2.2, VISIT_NO=-2.0,
                                    // CORRECTION overrides

  // 1) Embedding space (EMA)
  α = adaptiveAlpha(TV.confidence, |w|)
  if w > 0:
    TV.mu ← (1-α)·TV.mu + α·p.embedding_place
  else if w < 0:
    // odpychanie: przesuń mu lekko od p, zwiększ sigma w wymiarach różnicy
    TV.mu ← TV.mu - α·|w|·normalize(p.embedding_place - TV.mu)
  TV.sigma ← decayUncertainty(TV.sigma, α, w)

  // 2) Affinity maps (signed counts with decay)
  for key in {city, district, property_type, tx_type}:
    TV.affinity[key][p.key] ← decay + w · affinityBoost(key)

  // 3) Price/space moments
  if w > 0: push rolling liked price/area
  if w < 0: push rolling disliked price/area
  recompute mu_like / mu_dislike / elasticity

  // 4) Contradiction
  TV.contradiction_index ← estimateContradiction(TV)

  // 5) Confidence
  TV.confidence ← f(n_events, stability(TV.mu), 1 - contradiction_index)

  return TV
```

`eventWeight` respektuje DNA-05 (wizyta) i DNA-04 (korekta ma `correction_multiplier`).

---

## 5. Preference Vector (wektor preferencji / prior)

### 5.1 Definicja

**Preference Vector (PV)** = miękkie hipotezy o użytkowniku z:

- opcjonalnych chipów life-shift (nie formularz bramy),  
- onboarding EstateOS legacy (jeśli istnieje) jako **słaby prior**,  
- kontekstu vertical/tx,  
- jawnych korekt użytkownika.

PV **nigdy nie zastępuje** TV. Przy konflikcie: DNA-01.

### 5.2 Struktura

```text
PreferenceVector {
  user_id
  priors: {
    tx_type_prior: Dist
    city_prior: Dist
    budget_hypothesis: { center, width, source } | null
    space_hypothesis: { area_center, rooms_center } | null
  }
  strength: float          // 0..1; low na starcie Discovery
  source_tags: { life_shift_chips?, legacy_search?, user_correction? }
  expires_partial_at       // hipotezy life-shift wygasają szybciej niż TV
}
```

### 5.3 Blend TV ⊕ PV

```text
algorithm EffectiveTaste(TV, PV, DNA):
  λ = clamp(PV.strength * (1 - TV.confidence), 0, 0.45)  // prior max 45% gdy TV słabe
  // W przestrzeni embedding:
  mu_eff ← normalize((1-λ)·TV.mu + λ·priorEmbedding(PV))
  // Affinity: TV dominuje; PV dodaje tylko gdy TV.confidence < τ
  return EffectiveTaste(mu_eff, blended_affinity, blended_price)
```

Gdy `TV.confidence` wysokie → `λ → 0` (prior praktycznie znika).

---

## 6. Behaviour Engine

### 6.1 Rola

Normalizuje surowe zdarzenia UX do **sygnałów uczących**, wykrywa szum, wahanie, kompulsję, sprzeczności.

### 6.2 Taxonomia zdarzeń (logiczna)

```text
EventType =
  DISCOVERY_OPEN_SESSION
  DISCOVERY_VIEW_CARD
  DISCOVERY_PHOTO_VIEW
  DISCOVERY_DEPTH_OPEN
  DISCOVERY_LIKE
  DISCOVERY_DISLIKE
  DISCOVERY_PRIORITY
  DISCOVERY_SAVE
  DISCOVERY_UNDO
  DISCOVERY_INSIGHT_OPEN
  DISCOVERY_CORRECTION
  DISCOVERY_VISIT_FEEDBACK
  DISCOVERY_PAUSE
  DISCOVERY_RESUME
  DISCOVERY_PHASE_END
```

### 6.3 Struktura zdarzenia

```text
BehaviourEvent {
  event_id
  user_key
  session_id
  type: EventType
  place_id?
  photo_index?
  dwell_ms?
  decision_latency_ms?
  reason_code?            // tylko dislike optional
  visit_outcome?          // YES | NO | DIFFERENT
  correction_target?      // which inference rejected
  client_context: { platform, tempo_mode }
  at
}
```

### 6.4 Algorytmy Behaviour Engine

#### A) Hesitation & noise gate

```text
algorithm GateEvent(e):
  if e.type in {LIKE, DISLIKE, PRIORITY}:
    if e.decision_latency_ms < τ_bot: mark suspicious (downweight)
    if e.decision_latency_ms > τ_hesitation: attach flag hesitation=true
  if rapid_fire_count(session) > τ_compulsion: emit tempo_mode=suggest_pause
  return e
```

#### B) Session motif detection

Wykrywa sekwencje: `DEPTH→LIKE`, `GALLERY_LONG→PRIORITY`, `FAST_DISLIKE` (płytkie odrzucenie).  
Motywy modulują wagi (głębsze zaangażowanie → większy wpływ na TV).

#### C) Contradiction detector

```text
algorithm ContradictionIndex(TV, recent_events):
  // np. naprzemienne LIKE w sprzecznych klastrach embedding / city
  return score 0..1
```

Jeśli `> τ_c` → sygnał do UX `S-16` + zwiększenie `exploration_hunger` + wzrost `TV.sigma`.

#### D) Undo reconciliation

UNDO cofa ostatnią aktualizację TV w oknie (stack odwrotny wag), zgodnie z godnością pomyłki.

---

## 7. Discovery Score

### 7.1 Definicja

**Discovery Score** `S(u, p) ∈ [0, 100]` = przewidywana wartość **spotkania** użytkownika `u` z miejscem `p` w sensie North Star (jasność + trafność emocjonalna), nie CTR.

### 7.2 Składowe (additivne z capami DNA)

```text
S = clip_0_100(
    S_embed          // podobieństwo TV.mu ↔ p.embedding_place
  + S_affinity       // city/district/type/tx signed affinities
  + S_econ           // zgodność z rozkładem ceny ujawnionej (NIE hard max)
  + S_space          // area/rooms affinity
  + S_media          // jakość/diverse media (Smart Gallery readiness)
  + S_explore_bonus  // bonus eksploracji gdy hunger wysoki
  - S_penalties      // recent dislike place, visit_no, correction bans soft
)
```

### 7.3 Algorytmy składowych (szkic)

**S_embed**

```text
cos = cosine(TV.mu, p.embedding_place)
S_embed = w_e * map_cos_to_points(cos, TV.sigma)
// wysoka sigma ⇒ mniej agresywne punkty (nieudawana pewność)
```

**S_econ (anty-filtr)**

```text
if TV.price.mu_like is null: S_econ = 0
else:
  z = abs(log(p.price) - log(TV.price.mu_like))
  S_econ = w_price * soft_kernel(z, TV.price.elasticity)
  // miejsca droższe mogą dostać dodatni score jeśli elasticity wysoka
  // miejsca w „mu_dislike” dostają karę soft_kernel do disliked center
```

**S_explore_bonus**

```text
if novelty(p | recent_shown, TV.mu) high AND TV.exploration_hunger high:
  S_explore_bonus = w_x * novelty
else 0
```

**Penalties**

```text
- strong if same place VISIT_NO or DISLIKE recently
- soft if district affinity deeply negative BUT DNA-08 forbids permanent hard ban
```

### 7.4 Struktura wyniku scoringu

```text
ScoredPlace {
  place_id
  score: float
  components: Map<component_name, float>
  reasons: ReasonAtom[]     // do Explainable AI
  explore_flag: bool
  confidence: float
}
```

---

## 8. Discovery Engine (orkiestracja)

### 8.1 Pipeline serwowania talii

```text
algorithm BuildDiscoveryDeck(user, session, DNA):
  TV ← loadTaste(user)
  PV ← loadPreference(user)
  ET ← EffectiveTaste(TV, PV, DNA)

  candidates ← CandidateRecall(ET, session)   // ANN po embedding + diversity nets
  // NIE: SQL filter price BETWEEN

  scored ← []
  for p in candidates:
    scored.append(Score(ET, p, session, DNA))

  ranked ← DiversifiedRank(scored, DNA)      // MMR / facility location style
  ranked ← EnsureExplorationFloor(ranked, DNA.min_exploration_ratio)
  ranked ← AttachExplanations(ranked, ET)

  return Deck{ cards: ranked[0..K], profile_snippet: snippet(TV) }
```

### 8.2 Candidate Recall (bez prostych filtrów)

1. **ANN** najbliżsi sąsiedzi `ET.mu` w `embedding_place`  
2. **Contrastive rings**: pierścień średniej nowości (eksploracja)  
3. **Graph expand**: miejsca podobne do ostatnich LIKE/PRIORITY (nie do filtrów)  
4. **Freshness spice**: lekki domieszanie świeżych miejsc w przestrzeni bliskiej TV  
5. Soft prior z PV tylko jako **boost recall**, nie jako delete gate

### 8.3 DiversifiedRank

Maksymalizuje: trafność − λ · redundancy(visual/geo/type).  
Cel: unikać „10 takich samych kawalerek z tym samym światłem renderu”.

### 8.4 Cold Start

```text
algorithm ColdStartDeck(DNA):
  TV ← empty with high sigma
  serve stratified diverse sample across:
    visual clusters × geo clusters × price bands (as strata, NOT user filters)
  aggressive exploration_hunger = 1
  explanations = "Dopiero Cię poznaję"
```

---

## 9. Adaptive Learning

### 9.1 Warstwy uczenia

| Warstwa | Kiedy | Co |
|---------|-------|----|
| Online | każde zdarzenie | UpdateTasteVector, contradiction, hunger |
| Session | koniec sesji | kompaktowanie rolling moments, decay affinities |
| Batch | offline | trening embeddingów place, kalibracja wag S_*, fairness audit |
| Feedback loop | visit + correction | reweight event classes |

### 9.2 Adaptive α (szybkość uczenia)

```text
α = α0 * (1 - confidence) * (1 + |w|) * (1 + depth_motif_bonus)
α ← clip(α, α_min, α_max)
```

Przy wysokiej pewności uczenie wolniejsze (stabilność).  
Przy korekcie użytkownika: krótki burst α (DNA-04).

### 9.3 Preference decay vs Taste persistence

- PV life-shift chips: szybki half-life  
- TV affinities: wolniejszy decay  
- VISIT_NO na place_id: silny lokalny ban czasowy, nie wieczny geo-ban

### 9.4 Anti-echo adaptation

```text
if echo_chamber_index(deck_history) > DNA.max:
  exploration_hunger ↑
  increase novelty ring in recall
```

---

## 10. Smart Gallery Engine

### 10.1 Cel

Ułożyć sekwencję zdjęć maksymalizującą **zrozumienie miejsca** (światło, układ, atmosfera), nie engagement scroll.

### 10.2 Struktura

```text
GalleryPlan {
  place_id
  sequence: AssetID[]
  roles: Map<AssetID, { hero, layout, light, context, avoid_duplicate }>
}
```

### 10.3 Algorytm

```text
algorithm PlanGallery(place, TV):
  assets ← scored by aesthetic, layout_clarity, light_proxy, uniqueness
  hero ← best(hero_score)
  seq ← [hero]
  while |seq| < N:
    pick asset maximizing
      information_gain(asset | seq)
      + mild alignment(asset_emb, TV.mu_visual_if_any)
      - redundancy(asset, seq)
  return seq
```

Personalizacja galerii jest **lekka**: nie ukrywa wad miejsca (DNA uczciwości podaży).  
Może jedynie lekko przestawić kolejność ku temu, na co użytkownik reagował (np. zieleń balkonowa), bez fałszowania.

### 10.4 Sygnał zwrotny

`PHOTO_VIEW` + dwell moduluje `depth_motif` i wagę kolejnego LIKE/PRIORITY (Behaviour Engine).

---

## 11. Explainable AI

### 11.1 Reason Atom

```text
ReasonAtom {
  code: enum {
    EMBEDDING_NEAR_LIKED,
    CITY_AFFINITY,
    DISTRICT_AFFINITY,
    TYPE_AFFINITY,
    PRICE_IN_REVEALED_BAND,
    AREA_AFFINITY,
    EXPLORATION_NOVELTY,
    PRIORITY_PATTERN,
    VISIT_CONFIRMED_PATTERN
  }
  strength: float
  human_template: string   // PL/EN/RU z tokenami
  evidence_refs: { place_ids_liked_near[], affinity_key? }
}
```

### 11.2 Generowanie wyjaśnień

```text
algorithm AttachExplanations(scored, ET):
  for each item:
    atoms ← top contributing positive components mapped to ReasonAtom
    filter atoms with strength < ε
    if item.score >= τ_explain and atoms empty:
      force at least EXPLORATION_NOVELTY or soft EMBEDDING reason
      OR down-cap score (DNA-03)
    item.reasons ← atoms[:3]
    item.human ← render(atoms[:1])  // UX pokazuje zwykle 1 zdanie
```

### 11.3 Kontrwyjaśnienie przy korekcie

Gdy użytkownik mówi „to nie ja” wobec `CITY_AFFINITY: Mokotów`:

```text
TV.affinity.city[Mokotów] ← TV.affinity.city[Mokotów] * decay_hard
TV.sigma ↑ on related dims
short-term suppress similar explanations
```

---

## 12. Discovery Engine — stany sesji AI

```text
EngineSessionState {
  session_id
  deck_cursor
  shown_ids: Set
  decision_count
  compulsion_risk
  tempo_mode: normal | slow | suggest_pause
  last_undo_stack: TasteDelta[]
  exploration_budget_remaining
}
```

---

## 13. Pseudokod end-to-end (jedna decyzja)

```text
onDecision(e):
  e ← BehaviourEngine.GateEvent(e)
  if e.type == UNDO: restore TasteDelta; return

  p ← PlaceStore.get(e.place_id)
  TV ← UpdateTasteVector(TV, e, p, DNA)
  maybe emit ContradictionCare(TV)

  if session needs refill:
    deck ← BuildDiscoveryDeck(user, session, DNA)
    push to UX S-02

  if e.type == PRIORITY: mark trope high_value
  if e.type == VISIT_*: AdaptiveLearning.reweight(place_cluster)
```

---

## 14. Metryki jakości silnika (nie vanity)

| Metryka | Sens |
|---------|------|
| Calibration of Score vs later VISIT_YES | Czy score przewiduje życie? |
| Time-to-first-resonance | Jakość cold start |
| Correction rate | Czy wnioski są aroganckie? |
| Echo chamber index | Różnorodność |
| Session clarity proxy | Mniej kompulsji, więcej DEPTH przed LIKE |
| Explanation acceptance | Czy „dlaczego” nie jest odrzucane |

Zakaz KPI: max swipe count jako cel optymalizacji (DNA-06).

---

## 15. Anty-wzorce (wyraźny zakaz)

| Anty-wzorzec | Dlaczego zakazany |
|--------------|-------------------|
| `WHERE price BETWEEN` jako rdzeń | To filtr, nie Discovery |
| Reguły if-else „jeśli 3 pokoje” | Fałszywa pewność deklaracji |
| Black-box score bez reason | Łamie DNA-03 i zaufanie |
| Ban dzielnicy po 1 dislike | Łamie fairness |
| Optymalizacja pod retencję sesji | Łamie zdrowie decyzyjne |
| Ukrywanie słabych zdjęć | Fałszuje miejsce |

---

## 16. Mapowanie na UX (kontrakt)

| Sygnał silnika | Ekran / Island |
|----------------|----------------|
| high contradiction | S-16 |
| exploration_hunger | S-09 poszerz / deck spice |
| reason atoms | S-11 |
| correction | S-12 |
| visit weight | S-19 → mocniejszy TV update |
| suggest_pause | S-13 soft |
| phase completed | S-24 stop serve |

---

## 17. Podsumowanie komponentów (checklist dostarczenia intel)

- [x] Discovery Engine — orkiestracja recall→score→diversify→explain  
- [x] Discovery Score — wieloskładnikowy, bez hard filter gate  
- [x] Taste Vector — ujawniony smak + niepewność  
- [x] Preference Vector — słaby prior, blend z limitem  
- [x] Behaviour Engine — wagi, szum, sprzeczności, undo  
- [x] Adaptive Learning — online/session/batch + anti-echo  
- [x] Smart Gallery — information gain sequence  
- [x] Discovery DNA — nienaruszalne constraints  
- [x] Explainable AI — reason atoms + korekty  

---

## Rejestr akceptacji

| Pole | Wartość |
|------|---------|
| Dokument | `docs/discovery/06-intelligence/01-discovery-ai-engine.md` |
| Status | `REVIEW` |
| Charakter | silnik AI · algorytmy · struktury danych |
| Następny | tylko po Twojej akceptacji |

**STOP.** Nie powstaje kod ani kolejny dokument do czasu Twojej decyzji.

**Koniec dokumentu `01-discovery-ai-engine.md`.**
