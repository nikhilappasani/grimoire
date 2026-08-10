# Role Question Banks: grill every question the role demands

- `content_version`: 0.3.0
- Question IDs are stable and never reused. Rewording keeps the ID.

Composition is two-tier and additive:

1. Pick **one** execution-subtype bank (§1), the primary match.
2. Layer **any** applicable persona/domain banks (§2) on top.
3. If no subtype bank matches strongly, use the **Universal deep-probe bank** (§3) and record
   `bank matched: none (universal fallback used)` in the Design Record. **Never fall through
   silently**: an unmatched role is a signal that the bank set needs a new row, and it is only
   visible if it is written down.

Interleave these through the base sections in [INTERVIEW.md](./INTERVIEW.md). A section is not done
until its base questions *and* its bank questions are answered or `OPEN:`.

---

## 1. Banks by execution subtype: pick the one primary match

### Diagnostic: root-cause and troubleshooting

- `diagnostic.q1`: "What symptom or signal starts the investigation, and where does the user first
  see it?"
- `diagnostic.q2`: "What evidence sources can it read: logs, run history, dashboards, config, code,
  and which are auth-gated so the user must fetch them?"
- `diagnostic.q3`: "What is the differential: the candidate root causes it should rule in or out, in
  priority order?"
- `diagnostic.q4`: "What is the cheapest diagnostic that eliminates the most causes first?"
- `diagnostic.q5`: "Where does diagnosis **stop**? Does it propose a fix, apply a fix, or only
  explain?"
- `diagnostic.q6`: "What must it never touch while diagnosing?" (no production writes, no restarts
  without approval)
- `diagnostic.q7`: "What does a confirmed root cause look like, versus an inconclusive result it
  should admit to?"

### Authoring: generates an artifact: code, config, docs, spec

- `authoring.q1`: "What is the exact artifact shape and where does it get written? Any template or
  scaffold to match?"
- `authoring.q2`: "Which conventions, linters, or schemas must the output satisfy to be accepted?"
- `authoring.q3`: "What existing assets should it reuse or extend rather than write from scratch?"
- `authoring.q4`: "What must it gather from the user before writing, versus infer with a stated
  assumption?"
- `authoring.q5`: "How is the artifact reviewed or tested before it counts as good?"
- `authoring.q6`: "What must never appear in the output?" (secrets, personal data, TODOs, placeholder
  credentials)

### Analysis: interprets data or artifacts, produces findings

- `analysis.q1`: "What question is the analysis answering, and who consumes the answer?"
- `analysis.q2`: "What data or artifacts are in scope, and what is explicitly excluded?"
- `analysis.q3`: "What method or rules define a valid finding versus noise? What confidence must it
  express?"
- `analysis.q4`: "How should it present results: ranked list, table, summary, diagram?"
- `analysis.q5`: "What would make a finding misleading, and how does it caveat uncertainty?"
- `analysis.q6`: "Is any input sensitive? How does it report without exposing raw sensitive data?"

### Validation: a gate: pass or fail against a standard

- `validation.q1`: "What standard or checklist is being validated against? Name the authoritative
  source."
- `validation.q2`: "Is the gate deterministic and scriptable, or judgment-based? Which checks are
  hard-fail versus warn?"
- `validation.q3`: "What is the exact PASS and FAIL output, and does FAIL block or merely advise?"
- `validation.q4`: "What are the false-positive and false-negative risks, and which side should it err
  toward?"
- `validation.q5`: "Can a human override a failure? If so, what must they record?"

### Orchestration: coordinates multiple steps, systems, or skills

- `orchestration.q1`: "What are the ordered steps and their dependencies? Which can run in parallel?"
- `orchestration.q2`: "What is the state between steps, and how does it recover from a mid-run
  failure: retry, rollback, or resume?"
- `orchestration.q3`: "Which steps are governed or irreversible and need confirmation gates?"
- `orchestration.q4`: "How does it know a step succeeded before advancing? What are the timeouts?"
- `orchestration.q5`: "What does it hand off to at the end, and what does partial completion look
  like?"

### Discovery: finds and inventories things

- `discovery.q1`: "What is being discovered, across what scope or boundary?"
- `discovery.q2`: "What sources does it search, and how does it de-duplicate and rank results?"
- `discovery.q3`: "How does it know the inventory is complete versus still partial?"
- `discovery.q4`: "What does it do with what it finds: report, tag, or act?"

### Planning: produces a plan, not the execution

- `planning.q1`: "What is the goal state, the constraints, and which parts are fixed versus flexible?"
- `planning.q2`: "What granularity of plan: milestones, tasks, or step-by-step? Who executes it?"
- `planning.q3`: "What dependencies, risks, and sequencing must the plan surface?"
- `planning.q4`: "What makes the plan 'approved' and ready to execute?"

### Review: evaluates someone else's work and gives feedback

- `review.q1`: "What is being reviewed, and against what rubric or standard?"
- `review.q2`: "What severity levels does feedback use, and which are blocking?"
- `review.q3`: "What must it always check regardless of the change?" (security, sensitive-data
  exposure, conventions, tests)
- `review.q4`: "Tone and format of feedback: inline comments, summary, or suggested edits?"
- `review.q5`: "What is out of scope for the review, so it doesn't sprawl?"

### Transformation: converts input A to output B

- `transformation.q1`: "What are the exact source and target formats or schemas? Point to their
  contracts."
- `transformation.q2`: "What mappings are 1:1, and where is information lost, derived, or defaulted?"
- `transformation.q3`: "How are invalid or unmappable inputs handled: skip, error, or quarantine?"
- `transformation.q4`: "How is a transformed batch verified for correctness and completeness?"
- `transformation.q5`: "Must the transformation be reversible or auditable?"

---

## 2. Banks by persona or domain: layer on top of the subtype bank

### Data Engineer

- `data-engineer.q1`: "Batch, streaming, or micro-batch? What is the SLA and the data
  volume/velocity?"
- `data-engineer.q2`: "Source and target platforms, and read versus write on each?"
- `data-engineer.q3`: "Partitioning, clustering, and incremental-load strategy? How are late-arriving
  and duplicate records handled?"
- `data-engineer.q4`: "Data-quality expectations, and where do the tests run: in-pipeline, CI, or
  post-load?"
- `data-engineer.q5`: "Data classification, retention, masking, and lineage requirements?"
- `data-engineer.q6`: "Backfill and reprocessing strategy? Schema-evolution and versioning policy?"

### Reviewer / change review

- `reviewer.q1`: "What languages and stacks, and which house style guides and linters apply?"
- `reviewer.q2`: "Security must-checks that are always in scope?" (secrets, injection, authorization,
  sensitive data in logs)
- `reviewer.q3`: "How does it treat generated or vendored code it shouldn't critique?"
- `reviewer.q4`: "Blocking versus non-blocking findings, and how are nits separated from defects?"

### Onboarding / teaching guide

- `onboarding.q1`: "Who is the audience, and what is their assumed starting knowledge?"
- `onboarding.q2`: "What is the setup path, and how does it verify each step actually worked?"
- `onboarding.q3`: "Which knowledge lives behind a login that the user must fetch?"
- `onboarding.q4`: "What does 'onboarded' mean: the observable end state that counts as success?"
- `onboarding.q5`: "What must it never do?" (run destructive setup, expose credentials, guess the
  environment)

### Architect / domain-knowledge capability

- `architect.q1`: "What model or taxonomy anchors it: a capability model, domain glossary, reference
  architecture?"
- `architect.q2`: "Which wiki or document-store spaces hold the source of truth, and who owns them?"
- `architect.q3`: "What diagram standards must outputs follow: notation, tooling, naming?"
- `architect.q4`: "How are conflicting or stale definitions across sources reconciled?"
- `architect.q5`: "What is authoritative versus illustrative, so it never presents an example as a
  rule?"

### Deployment / release / operations

- `deployment.q1`: "What environments and promotion path, and what gates each?"
- `deployment.q2`: "What is the rollback procedure and its trigger conditions?"
- `deployment.q3`: "Which actions are production-affecting and require change approval or
  confirmation?"
- `deployment.q4`: "What health signals confirm a good deploy, and what defines a failed one?"
- `deployment.q5`: "Blackout windows, freeze periods, or approval authorities to honor?"

### Convention / standard enforcement

- `convention.q1`: "What is the authoritative source of the convention, and its version?"
- `convention.q2`: "Is enforcement advisory or blocking? Auto-fixable or report-only?"
- `convention.q3`: "How are legacy exceptions and grandfathered cases handled?"
- `convention.q4`: "How does the convention get updated, and how does the capability track that
  change?"

---

## 3. Universal deep-probe bank: the fallback for any uncovered role

Use when no subtype bank matches strongly. These questions are role-agnostic and target the tacit
knowledge an expert holds but has never written down, which is the knowledge most worth capturing and
the knowledge most likely to be lost.

Record `bank matched: none (universal fallback used)` in the Design Record whenever this bank is used
as the primary. Recurring use of this bank is the signal to author a new subtype bank.

**The work as it happens today**

- `universal.q1`: "Walk me through the last time you did this by hand, start to finish. What did you
  actually open, read, and decide?"
- `universal.q2`: "How long did that take, and which part took the longest?"
- `universal.q3`: "Who else does this, and would they do it the same way? Where would they differ?"

**The tacit expertise**

- `universal.q4`: "What does someone experienced at this know that a competent newcomer would get
  wrong on their first attempt?"
- `universal.q5`: "What is the hardest judgment call in this work, and what makes it hard?"
- `universal.q6`: "What signal tells you early that something is off, before it becomes obvious?"
- `universal.q7`: "What rule of thumb do you use that isn't written down anywhere?"

**The edges**

- `universal.q8`: "What are the exceptions: the cases where the normal approach is wrong?"
- `universal.q9`: "What input have you seen that broke the usual process?"
- `universal.q10`: "When is the right answer 'don't do this at all'?"

**Failure**

- `universal.q11`: "What goes wrong most often, and how do you notice?"
- `universal.q12`: "What is the most expensive mistake possible here, and what prevents it today?"
- `universal.q13`: "What would you refuse to let an automated system do unsupervised?"

**Boundaries and handoffs**

- `universal.q14`: "What arrives on your desk before you start, and who produced it?"
- `universal.q15`: "Who receives your output, and what do they do with it next?"
- `universal.q16`: "Where does your responsibility end and someone else's begin?"

**Where the knowledge lives**

- `universal.q17`: "If you left tomorrow, what would your replacement need that isn't documented?"
- `universal.q18`: "Which of the facts you have told me would a colleague dispute?"
- `universal.q19`: "What would you need to look up rather than recall, and where would you look?"

> `universal.q18` is load-bearing. A fact two experts disagree about is not knowledge yet; mark it
> `OPEN:` and name both positions rather than recording one as settled.
