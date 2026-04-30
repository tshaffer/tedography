# Tedography Spec: Advanced Keyword Queries in Search

## Status

Proposed follow-on to the current keyword roadmap.

This spec assumes Tedography already has:

- keyword storage on assets
- keyword assignment UI
- hierarchical keyword maintenance
- basic keyword filtering in Search

This is the next search-focused keyword milestone after the basic workflow is stable.

## Working Name

**KW-05: Advanced Keyword Queries in Search**

You previously framed the roadmap roughly as:

- KW-01: keyword storage
- KW-02: keyword assignment UI
- KW-03: basic Search filtering by keywords
- KW-04: hierarchical keywords / maintenance
- next: advanced keyword querying in Search

This spec defines that next step.

---

## 1. Purpose

Tedography Search should support expressive keyword querying without forcing the user into a full boolean-query language on day one.

The goal is to cover the majority of real-world search cases with a UI that stays understandable and low-friction.

Examples of target queries:

- include `Hiking` and `Maui`
- include any of `Lori`, `Ted`, `Joel`
- exclude `Screenshots`
- search `Family Camp` while excluding `Duplicates`
- optionally include descendants of a parent keyword such as `Travel`
- combine keyword filtering with existing Search dimensions such as albums, people, date, photo state, and text

The design should prioritize:

- clarity
- predictable results
- low UI clutter
- compatibility with current Search patterns
- progressive enhancement toward more powerful querying later

---

## 2. Non-Goals

This phase does **not** attempt to deliver:

- arbitrary nested boolean expressions in v1
- a freeform query language parser in v1
- saved keyword-query templates in v1
- ranking/scoring based on keyword relevance
- fuzzy keyword matching
- cross-field boolean grouping such as `(keyword = Hiking OR album = Yosemite) AND person = Joel`

Those can come later if needed.

---

## 3. Product Positioning

This feature should be treated as:

- more expressive than the current single-keyword dropdown
- less complex than a full boolean query builder
- a natural next milestone after keyword hierarchy is already in place

This is intended to be the “high value, still simple” phase.

---

## 4. User Problems This Solves

### 4.1 Multiple include keywords

Users often want more than one keyword at once.

Examples:

- `Maui` + `Hiking`
- `Wedding` + `Ceremony`
- `Sunset` + `Beach`

### 4.2 Excluding noisy categories

Users often know a bucket they do **not** want.

Examples:

- include `Joel Soccer`, exclude `Screenshots`
- include `Travel`, exclude `Receipts`
- include `Family`, exclude `Duplicates`

### 4.3 Choice between “must have all” and “any is okay”

Sometimes the user wants intersection; sometimes union.

Examples:

- all of `Maui` and `Hiking`
- any of `Lori`, `Ted`, `Rachel`

### 4.4 Hierarchy-aware searches

Once keywords are hierarchical, selecting a parent should optionally match descendants.

Example:

- `Travel` may optionally include `Portugal`, `Maui`, `Australia`, etc.

---

## 5. Proposed UX Summary

Tedography Search should replace the single keyword dropdown with a compact **Keyword Query** section that supports three buckets:

- **Include**
- **Exclude**
- **Match mode** for Include: `All` or `Any`

Additionally, each selected keyword token should support an **Include descendants** toggle.

This yields strong practical power with minimal cognitive overhead.

---

## 6. Exact UI

## 6.1 Search panel section

Add a Search section labeled:

**Keywords**

Within it, show:

### Row A: Include keywords
- label: `Include`
- control: multi-select autocomplete/token picker
- placeholder: `Add keywords to include`

### Row B: Include match mode
- segmented control or radio group:
  - `Match all`
  - `Match any`

This applies only to the Include list.

### Row C: Exclude keywords
- label: `Exclude`
- control: multi-select autocomplete/token picker
- placeholder: `Add keywords to exclude`

### Row D: Hierarchy behavior
Preferred design: per-token descendant control, not one global switch.

Each selected token in Include or Exclude can show a small icon/toggle:

- `This keyword only`
- `Include descendants`

This can be represented as:
- a subtle branch/tree icon on the chip
- clicking it toggles descendant matching for that chip
- tooltip explains the behavior

Example chip rendering:

- `Travel`
- `Travel + descendants`
- `Family`
- `Family + descendants`

For visual compactness, the chip text can stay short while the icon state communicates descendant behavior.

### Row E: Summary text
Below the controls, show a one-line natural language summary when keywords are present.

Examples:

- `Match assets with all included keywords and none of the excluded keywords.`
- `Match assets with any included keyword and none of the excluded keywords.`
- `Include descendants for: Travel, Family.`

This is important for trust and readability.

---

## 6.2 Chip behavior

Each keyword chip should support:

- remove chip
- toggle descendant behavior
- optional tooltip showing full path, for example:
  - `Travel > Portugal > Madeira`
  - `People-Adjacent > Family Events`

Recommended chip affordances:

- chip body: keyword label
- hover tooltip: full hierarchy path
- small branch icon:
  - off = keyword only
  - on = keyword plus descendants

Do **not** put path text directly in the chip unless needed for disambiguation, because it will get noisy.

If the same label can appear in different branches, autocomplete should disambiguate using breadcrumb text in the dropdown.

---

## 6.3 Empty state

If no keywords are selected:

- Search behaves exactly as today with respect to keywords
- show helper text:
  - `No keyword filtering`

---

## 6.4 Interaction with existing Search UI

This keyword query section should live in the Search panel alongside the existing filters.

It should combine with other filters using **AND** semantics across filter categories.

So:

- albums
- people
- date
- photo state
- text
- keywords

all narrow the result set together.

Keyword logic is only “special” *within the keyword section*.

---

## 7. Exact Query Semantics

## 7.1 Asset keyword model assumption

Assume each asset has zero or more assigned `keywordIds`.

Hierarchy is defined on the `Keyword` collection through parent/child relationships.

---

## 7.2 Include semantics

The Include list is the positive selector set.

Let `I` be the set of selected include clauses.

Each include clause contains:

- `keywordId`
- `includeDescendants: boolean`

Each clause expands to a set of matching keyword IDs:

- if `includeDescendants = false`, match set is `{keywordId}`
- if `includeDescendants = true`, match set is `{keywordId} ∪ all descendant keyword ids`

For a given asset, a clause is satisfied if the asset contains **at least one** keyword from that clause’s expanded match set.

### Include mode: Match all

An asset passes Include if **every** include clause is satisfied.

Example:

Include:
- `Maui`
- `Hiking`

Mode:
- `Match all`

Result:
- asset must match `Maui`
- and must match `Hiking`

### Include mode: Match any

An asset passes Include if **at least one** include clause is satisfied.

Example:

Include:
- `Lori`
- `Ted`
- `Rachel`

Mode:
- `Match any`

Result:
- asset may contain any one or more of those

---

## 7.3 Exclude semantics

Let `E` be the set of selected exclude clauses.

Each exclude clause contains:

- `keywordId`
- `includeDescendants: boolean`

Each clause expands the same way as Include.

An asset fails Exclude if it matches **any** exclude clause.

Equivalently:

- Exclude clauses are always OR’d together internally
- if any exclusion matches, remove the asset

Example:

Exclude:
- `Screenshots`
- `Receipts`

Result:
- remove assets tagged with either of those

---

## 7.4 Combined keyword semantics

Overall keyword filtering is:

`IncludePass AND NOT ExcludePass`

More explicitly:

- first evaluate the Include bucket
- then remove anything matching any Exclude clause

### Edge case: no Include clauses

If Include is empty, then Include should impose no restriction.

So with only Exclude clauses:

- show all assets except excluded ones

### Edge case: no Exclude clauses

If Exclude is empty, only Include rules apply.

### Edge case: keyword appears in both Include and Exclude

If the same effective keyword appears in both:

- Exclude wins
- show a warning state in the UI

Recommended UI behavior:
- show a small inline warning:
  - `A keyword is both included and excluded. Exclude will take precedence.`
- optionally highlight the conflicting chips

This avoids ambiguous or surprising behavior.

---

## 7.5 Descendant semantics

When `includeDescendants` is enabled for a selected keyword, matching should include the selected keyword itself **and** all descendants in the hierarchy.

Example hierarchy:

- `Travel`
  - `Portugal`
    - `Madeira`
    - `Lisbon`
  - `Hawaii`
    - `Maui`

Examples:

- `Travel` only -> matches assets tagged exactly `Travel`
- `Travel + descendants` -> matches assets tagged `Travel`, `Portugal`, `Madeira`, `Lisbon`, `Hawaii`, `Maui`, etc.

Important rule:
- descendant expansion is based on the current keyword tree at query time

That keeps behavior aligned with the current hierarchy.

---

## 7.6 No implicit ancestor matching

If an asset is tagged only with `Madeira`, it should **not** automatically count as tagged with `Portugal` or `Travel` unless descendant-aware matching is explicitly requested on the query side.

This keeps stored metadata simple and avoids hidden indexing semantics.

---

## 8. Example Queries

## 8.1 Simple intersection

Include:
- `Maui`
- `Hiking`

Mode:
- `Match all`

Exclude:
- none

Meaning:
- assets tagged with both `Maui` and `Hiking`

---

## 8.2 Simple union

Include:
- `Ted`
- `Lori`
- `Joel`

Mode:
- `Match any`

Meaning:
- assets matching any of those keywords

---

## 8.3 Include + exclude

Include:
- `Travel`

Mode:
- `Match all`

Exclude:
- `Receipts`

Meaning:
- travel-related assets except receipts

If `Travel` has descendants enabled:
- include all child travel destinations too

---

## 8.4 Parent with descendants

Include:
- `Portugal + descendants`

Mode:
- `Match all`

Meaning:
- assets tagged with `Portugal`, `Madeira`, `Lisbon`, etc.

---

## 8.5 Mixed example

Include:
- `Family`
- `Beach`

Mode:
- `Match all`

Exclude:
- `Screenshots`

Meaning:
- family beach photos, not screenshots

---

## 8.6 Noise-reduction example

Include:
- `Joel Soccer`

Mode:
- `Match all`

Exclude:
- `Blurry`
- `Duplicates`

Meaning:
- likely usable soccer photos of Joel

---

## 9. UI Behavior Details

## 9.1 Autocomplete dropdown behavior

The keyword picker should:

- support typeahead search
- show breadcrumb/path in results when helpful
- allow repeated quick entry without closing the panel
- exclude already-selected exact same clause from the same bucket

Suggested dropdown row format:

- primary: keyword label
- secondary: full path, if any

Example:

- `Madeira`
  - `Travel > Portugal > Madeira`

---

## 9.2 Clear affordances

Provide:

- `Clear include`
- `Clear exclude`
- or one section-level `Clear keywords`

Do not require removing chips one by one for large edits.

---

## 9.3 Compact vs expanded mode

Default:
- compact section with Include, Match mode, Exclude

Advanced later:
- optional “more” affordance for future boolean/grouping support

Do not expose a full query builder in this phase.

---

## 9.4 Result explanation

If keyword filters are active, Search should show an active-filter summary chip or summary text in the results area.

Examples:

- `Keywords: all of Maui, Hiking`
- `Keywords: any of Lori, Ted, Rachel`
- `Keywords: excluding Screenshots`
- `Keywords: Travel+descendants, excluding Receipts`

This is important once the query becomes richer than a single dropdown.

---

## 10. URL / State Model

The Search state should preserve advanced keyword query settings so they survive navigation, refresh, and sharable URLs where applicable.

Suggested state shape:

```ts
type KeywordQueryClause = {
  keywordId: string;
  includeDescendants: boolean;
};

type KeywordQueryState = {
  include: KeywordQueryClause[];
  includeMode: 'all' | 'any';
  exclude: KeywordQueryClause[];
};
```

Suggested Search state:

```ts
type SearchState = {
  // existing search fields...
  keywordQuery?: KeywordQueryState | null;
};
```

If Search state is serialized into URL params, use an explicit structured encoding rather than a fragile human syntax.

Example conceptual encoding:

- `kinc=kw1,kw2+`
- `kmode=all`
- `kexc=kw9,kw10+`

Where `+` might indicate descendants.

But if URL encoding becomes awkward, a JSON-based internal state persisted in Redux/router state is fine initially.

Primary requirement:
- state must round-trip reliably

---

## 11. Backend / Query Logic

## 11.1 Preferred implementation approach

Apply keyword filtering in the same search pipeline as other filters.

If the current Search implementation is client-side over already-loaded assets, advanced keyword filtering can start there.

If Search is already server-backed or moves there later, preserve the same semantics exactly.

The semantics matter more than where evaluation runs.

---

## 11.2 Hierarchy expansion

When the query is evaluated:

- for each clause with `includeDescendants = true`
- expand to a concrete set of descendant keyword IDs

This can be done by:

- frontend using a keyword tree already in memory, or
- backend using a keyword graph/tree lookup

For correctness and consistency, expansion should use the current canonical hierarchy.

---

## 11.3 Performance notes

For moderate library sizes, in-memory filtering is likely fine.

If performance becomes an issue, good next steps would be:

- precompute descendant lookup maps
- memoize expanded clause sets
- maintain a `keywordId -> descendantIds[]` index in memory
- move filtering server-side if asset volume or query complexity demands it

This phase should not over-engineer performance before needed.

---

## 12. Proposed Validation Rules

## 12.1 Invalid keyword ids

If a stored search state references a deleted keyword:

- ignore that clause
- show a subtle warning in the Search UI
- optionally display:
  - `1 unavailable keyword filter was ignored`

Do not hard-fail the whole query.

---

## 12.2 Cycles in hierarchy

The keyword maintenance system should already prevent cycles.

Advanced keyword querying assumes the hierarchy is acyclic.

---

## 12.3 Duplicate clauses

Avoid exact duplicates within the same bucket.

Examples to suppress:

- `Maui`
- `Maui` again

But it is okay to allow:

- `Maui`
- `Maui + descendants`

Though even that may be worth normalizing:
- if both appear in the same bucket, keep only `Maui + descendants`

Recommended normalization:
- within a bucket, the broader clause replaces the narrower duplicate

---

## 12.4 Conflict detection

If an effective include set and effective exclude set overlap, show a warning, but still run the query.

Rule:
- Exclude wins

This preserves safety and predictability.

---

## 13. Rollout Plan

## Phase 1: Multi-keyword include/exclude
Deliver:

- Include multi-select
- Match mode: all / any
- Exclude multi-select
- summary text
- result summary chips

No descendant support yet.

This is already highly valuable.

### Why Phase 1 first
It captures most real user need with minimal complexity.

---

## Phase 2: Per-keyword descendant matching
Deliver:

- per-chip descendant toggle
- breadcrumb/path display in autocomplete
- hierarchy-aware evaluation

This leverages KW-04 directly.

---

## Phase 3: Polishing and trust
Deliver:

- conflict warnings
- better active-filter summaries
- clear/reset affordances
- URL/state persistence cleanup
- disabled/ignored-keyword warnings for deleted keywords

---

## Phase 4: Optional future extension
Only if still needed:

- grouped boolean logic
- nested query builder
- natural language to query translation
- saved keyword searches

This should be demand-driven, not assumed.

---

## 14. Recommendation

The recommended implementation target is:

### First shipping version
- Include keywords
- Exclude keywords
- Include mode = `Match all` / `Match any`

### Second shipping version
- add per-chip `include descendants`

This is the right balance between power and simplicity.

It avoids prematurely turning Search into a complicated rules engine while still solving the most common real-world keyword search needs.

---

## 15. Suggested Acceptance Criteria

## KW-05a: Multi-keyword include/exclude
A user can:

- add multiple include keywords
- choose `Match all` or `Match any`
- add multiple exclude keywords
- see a readable summary of the active keyword query
- combine keyword querying with existing Search filters
- refresh or navigate away and back without losing the keyword query state

Query semantics are:

- Include + `all` => every include clause must match
- Include + `any` => at least one include clause must match
- Exclude => any exclude match removes the asset
- overall => `IncludePass AND NOT ExcludeMatch`

## KW-05b: Hierarchy-aware matching
A user can:

- toggle descendant matching per keyword chip
- see which chips include descendants
- search for parent keywords and optionally include children
- trust that descendant behavior is reflected in summary text and results

---

## 16. Suggested UI Copy

Section title:
- `Keywords`

Labels:
- `Include`
- `Match`
- `Exclude`

Match options:
- `Match all`
- `Match any`

Placeholders:
- `Add keywords to include`
- `Add keywords to exclude`

Helper summary examples:
- `Matching all included keywords and excluding any excluded keywords.`
- `Matching any included keyword and excluding any excluded keywords.`

Conflict warning:
- `Some keywords are both included and excluded. Exclude takes precedence.`

No filters helper:
- `No keyword filtering`

---

## 17. Final Product Judgment

This feature should be considered the natural next keyword-search milestone for Tedography.

It is strong enough to support real curation/search workflows, but still small enough to fit the project’s incremental roadmap style.

It should be prioritized ahead of any full boolean query builder.

If later you still feel constrained after using:

- include
- exclude
- all/any
- descendants

then Tedography can justify a richer boolean/grouped query UI.

But this spec is the right next stop.
