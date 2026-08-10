# Knowledge

The curated knowledge base a running skill reads: distilled OKF concepts, one per file, foldered by
each concept's `type`.

**This directory is deliberately empty right now, and that is the correct state.**

Nothing writes here during an interview. LoreWeaver puts an interview's concepts in
`compendium/<slug>/knowledge/`, next to the transcript and documents they were drawn from, so a
capture reviews as a single unit. See
`skills/loreweaver/references/OUTPUT-CONTRACT.md` §1.

Concepts arrive here **later**, promoted by the build step when an approved capture is turned into a
skill. That step is the generator, which is not written yet. Keeping promotion separate from capture
is what keeps this base trustworthy: if every interview wrote straight into it, it would fill with
unreviewed drafts and concepts from captures nobody ever merged.

So the reading order is:

```text
interview  →  compendium/<slug>/knowledge/   (draft, under review)
merge      →  a human accepts the capture
build      →  knowledge/                     (curated, read at runtime)
```

The folder-to-`type` mapping and the concept file format are in
`skills/loreweaver/references/KNOWLEDGE-CAPTURE-OKF.md` §2–§3. `grimoire check-knowledge` validates
both wherever a bundle lives, here or under a capture.

This directory is the **default** `knowledge` root. Override with `GRIMOIRE_KNOWLEDGE_ROOT` or
`roots.knowledge` in `grimoire.config.json`. In practice, point it at its own repository so the
knowledge outlives any one project.
