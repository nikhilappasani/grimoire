---
type: Reference
category: Domain Knowledge
title: Programming Rust, 2nd ed. (Blandy, Orendorff & Tindall)
description: Deep-dive Rust reference covering systems-level concepts, ownership semantics, and advanced patterns
why: Complements The Rust Book with deeper explanations of why Rust works the way it does — essential for learners who want to understand, not just use
resource: https://www.oreilly.com/library/view/programming-rust-2nd/9781492052586/
tags: [rust, learning, reference, advanced]
timestamp: 2025-07-15
source_system: Public docs
access_state: linked
sensitivity: public
---

# Programming Rust, 2nd ed

By Jim Blandy, Jason Orendorff & Leonora F. S. Tindall (O'Reilly, 2021).
Available via O'Reilly subscription or purchase. Not freely available online.

## When PAC should cite this

- When the learner needs a deeper explanation than The Rust Book provides
- When covering: ownership internals, trait object dispatch, unsafe Rust, concurrency patterns
- Cite as: "Chapter N of *Programming Rust* (Blandy & Orendorff) goes deeper on this."

## Key chapter areas

| Area | Topic |
| --- | --- |
| Ownership & moves | Why values move, when copies happen, the `Copy` trait |
| References | Shared vs. mutable, lifetime rules in depth |
| Expressions | Rust's expression-oriented evaluation model |
| Error handling | `Result` chains, custom error types, `thiserror`/`anyhow` patterns |
| Traits and generics | Blanket impls, trait objects (`dyn Trait`), associated types |
| Closures | Capture modes: `Fn`, `FnMut`, `FnOnce` |
| Iterators | Adapter chains, writing custom iterators |
| Concurrency | Threads, channels, `Arc<Mutex<T>>` |
| Async | Futures, executors, `async`/`await` internals |
