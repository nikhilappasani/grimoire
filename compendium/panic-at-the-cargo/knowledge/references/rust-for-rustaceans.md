---
type: Reference
title: Rust for Rustaceans (Gjengset)
description: Intermediate-to-advanced Rust book covering the concepts that trip up developers who already know the basics
why: Bridges the gap between knowing Rust syntax and understanding why it works — essential for learners hitting intermediate walls
resource: https://nostarch.com/rust-rustaceans
tags: [rust, learning, intermediate, advanced]
timestamp: 2025-07-15
source_system: Public docs
access_state: linked
sensitivity: public
---

# Rust for Rustaceans

By Jon Gjengset (No Starch Press, 2021). Available for purchase. Not freely available online.

## When PAC should cite this

- When the learner has basic Rust working and starts hitting deeper ownership/lifetime walls
- When covering: `Pin`, `Send`/`Sync`, async internals, macro authoring, FFI
- When a learner asks "why does Rust do it this way?" at an intermediate level
- Cite as: "Chapter N of *Rust for Rustaceans* (Gjengset) explains the underlying model for this."

## Key chapter areas

| Topic | Concept covered |
| --- | --- |
| Foundations | Memory layout, ownership model internals, `Drop` ordering |
| Types | `Sized`, `?Sized`, `PhantomData`, type-state pattern |
| Traits | Blanket impls, `Into`/`From` conventions, coherence |
| Error handling | `std::error::Error`, ergonomic crate patterns |
| Lifetimes | Variance, higher-ranked trait bounds (HRTBs) |
| Async | `Poll`, `Waker`, `Pin`, writing custom futures |
| Macros | Declarative and procedural macro authoring |
| Concurrency | `Send`/`Sync` semantics, lock-free patterns |
| FFI | Calling C from Rust, `repr(C)`, `unsafe` contracts |
| Testing | Integration testing, fuzzing, benchmarking |

## Note

Assumes the learner already knows Rust basics. Pair with *The Rust Book* for learners at beginner level.
