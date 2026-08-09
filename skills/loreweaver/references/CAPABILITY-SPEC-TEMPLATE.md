# Capability Specification — Template & Emit Format

- `spec_version`: 0.2.0

The Capability Specification is **the asset**. It captures *what capability should exist and the
qualities its realization must satisfy*, and defers *how* to whatever generates the implementation.
Emit it as markdown so it versions in git alongside everything derived from it.

A generated `SKILL.md` or manifest is a **downstream artifact** of this file. When the capability
changes, edit the specification and regenerate. Never hand-edit a generated artifact and treat it as
the source of truth.

## 1. Where to write it and how to name it

- **Location:** the configured `specs` root. Resolution order is in
  [OUTPUT-CONTRACT.md](./OUTPUT-CONTRACT.md) §1. A configured root that does not exist is an error —
  ask the user, do not create it silently.
- **Filename:** `<slug>-capability-spec.md`, where `<slug>` is the kebab-case of the capability name
  from `base.s1.q5`. "Claims Triage Diagnostician" → `claims-triage-diagnostician-capability-spec.md`.
  Every specification is uniquely named after the capability it describes, so they never collide.
- **Collisions:** if that filename already exists — you are re-specifying the same capability — append
  a date suffix: `<slug>-capability-spec-<YYYYMMDD>.md`. **Never overwrite a prior specification.**

## 2. Emit format

Fill every section. Use `ASSUMPTION:` and `OPEN:` where unresolved — never a silent blank.

```markdown
---
spec_version: 0.2.0
content_version: 0.3.0
slug: <slug>
emitted: <ISO-8601 date>
---

# Capability Specification: <Name>

- Version: 0.1
- Lifecycle: Proposed | Experimental | Pilot | Approved | Deprecated
- Owner: <team/handle>
- Reviewers: <handles>
- Dependencies: <other capabilities, or none>

## 1. Metadata
- Summary: <one paragraph — what problem it solves, who benefits, why it exists>
- Personas: <list>
- Working Domain: <domain>
- Capability Category: Convention | Domain Knowledge | Execution Capability
- Execution Subtype (if execution): Diagnostic | Authoring | Analysis | Validation | Orchestration | Discovery | Planning | Review | Transformation

## 2. Problem Statement
<the business or engineering need, no implementation talk>

## 3. Desired Outcomes
- <observable outcome 1>
- <observable outcome 2>

## 4. User Intent (triggers)
- <example request 1>
- <example request 2>
- <example request 3>
- Near-misses that must NOT trigger it: <list>

## 5. Inputs
- <input> — Required | Optional | Derived
## 5b. Outputs
- <artifact produced> — acceptance check: <how we know it is good>

## 6. Enterprise Knowledge
### Conventions
- <standard it must follow>
### Business/Domain Facts Required
- <domain fact or contract the capability must know>  (mark OPEN: if not confirmed)
### External Systems
- <system> — read-only | read-write
### Knowledge Sources (provenance — becomes an OKF `knowledge/` bundle)
Columns and their permitted values are defined in KNOWLEDGE-CAPTURE-OKF.md §8. Do not restate them.

| Title | Type | Source system | Resource URL | Access state | Sensitivity |
|---|---|---|---|---|---|
| <concept> | <see OKF §3> | <see OKF §8> | <url or none> | <see OKF §8> | <see OKF §8> |

- Pending items remain `OPEN:` stubs until the user supplies the content.

## 7. Behavioral Requirements
- Always <...>
## 7b. Constraints (hard "never" rules)
- Never <...>
## 7c. Irreversible Actions
- <action> — requires explicit human confirmation

## 8. Success Criteria
- <per-run observable success>
## 8b. Evaluation Dimensions (ranked — top three)
1. <dimension>
2. <dimension>
3. <dimension>

## 9. Distribution & Scope
- Distribution: Enterprise | Organization | Product | Team | Repository | Individual Workspace
- Out of Scope:
  - <adjacent thing it will not do>
- Notes: <non-directive notes for maintainers>

## 10. Generation Guidance (preferences, not mandates)
- Context Requirements: Always Loaded | Just-In-Time | Conditional | User Prompted
- Execution Preference: Deterministic | Interactive | Autonomous
- Preferred Generation Strategy: Instruction | Skill | Workflow | Agent | Hybrid
- Evaluation Strategy: Unit | Scenario | Human Review | Regression Suite

## Open Items
- OPEN: <unresolved question blocking finalization>

## Appendix A — Design Record (interview provenance — an artifact, not runtime knowledge)
Captures the rationale the ten sections don't hold, so the specification can be audited and
regenerated. This never enters the `knowledge/` bundle.
- Bank matched: <bank name> | none (universal fallback used)
- Key decisions: <decision → why>
- Alternatives considered and rejected: <option → reason rejected>
- Assumptions resolved during the interview: <ASSUMPTION → resolution>
- Reuse-vs-create outcome: <extended existing capability X | net-new, because ...>
- Raw transcript: `compendium/<slug>/transcript.md` (see [OUTPUT-CONTRACT.md](./OUTPUT-CONTRACT.md) §3), or "not retained"
```

## 3. The nine evaluation dimensions

**This is the authoritative list.** `base.s7.q20` reads it to the user before asking for a ranking —
a ranking made against an invisible menu is arbitrary, and the ranking is load-bearing for whatever
generates the implementation.

| Dimension | Definition |
|---|---|
| **Correctness** | Does the realization produce the intended result? |
| **Completeness** | Is the required behaviour and coverage present? |
| **Safety** | Are failure modes and unsafe behaviour controlled? |
| **Governance Compliance** | Does it adhere to organizational policy and process? |
| **Reusability** | Can it be shared and reapplied beyond its first context? |
| **User Experience** | Is the interaction clear, usable, and appropriate? |
| **Cost** | Is execution and implementation footprint efficient? |
| **Latency** | Is it responsive enough for its intended usage? |
| **Maintainability** | How easily can the generated implementation evolve? |

Ranking the top three is a forcing function. If a user ranks all nine as critical, they have not made
a trade-off — push back and make them choose.

## 4. Quality bar before you emit

The process rules are in [GRILL-DISCIPLINE.md](./GRILL-DISCIPLINE.md). These are the pre-emit checks
on the document itself:

- Every section present. No silent blanks — `OPEN:` instead.
- **MECE knowledge inventory:** every source has exactly one location, one access state, one
  sensitivity; nothing relevant missing; nothing double-counted.
- **No implementation artifacts inside the specification** — no prompt text, no `SKILL.md` body, no
  manifest. If it belongs to the realization, it does not belong here.
- No real personal or regulated data. Examples are synthetic. Sensitive sources are linked via
  `resource:`, never copied — see [KNOWLEDGE-CAPTURE-OKF.md](./KNOWLEDGE-CAPTURE-OKF.md) §7.
- Outcomes are **observable**, not aspirational. "Improves data quality" fails; "flags unclassified
  columns before publish" passes.
- Constraints include the non-negotiables in [OUTPUT-CONTRACT.md](./OUTPUT-CONTRACT.md) §5: no
  secrets, no sensitive-data exposure, no fabricated logic, confirm before irreversible actions.
- `Bank matched:` is filled in. If the universal fallback was used, it says so explicitly.

---
*Capability Specification — product-spec format for stable intent and regenerable implementation.*
