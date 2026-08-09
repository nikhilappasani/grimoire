---
type: Reference
title: Command-Line Rust (Youens-Clark)
description: Project-based book teaching Rust by reimplementing Unix CLI tools — ideal for project-driven learners
why: Matches PAC's project-first philosophy exactly; learner builds real programs chapter by chapter
resource: file:///home/nikhilappasani/Downloads/Command-Line%20Rust.pdf
tags: [rust, learning, cli, projects]
timestamp: 2025-07-15
source_system: Local file
access_state: extracted
sensitivity: public
---

# Command-Line Rust

By Ken Youens-Clark (O'Reilly, 2022). Local copy at
`/home/nikhilappasani/Downloads/Command-Line Rust.pdf`.

## What it teaches

Each chapter reimplements a familiar Unix tool (`head`, `cat`, `wc`, `grep`, etc.) in Rust.
Covers: CLI argument parsing, stdin/stdout/stderr, file I/O, regular expressions, testing with TDD,
error handling with `Result`, string/vector manipulation, iterators, closures.

## When PAC should cite this

- When the learner's project is a CLI tool or involves file/stream I/O
- When introducing `clap` or `structopt` for argument parsing
- When demonstrating how to write tests alongside Rust code (TDD examples throughout)
- Cite as: "Chapter N of *Command-Line Rust* (Youens-Clark) has a working example of this pattern."

## Key project arc

| Chapter | Tool reimplemented | Core Rust concept introduced |
| --- | --- | --- |
| 1 | `hello` | Program structure, `cargo new`, basic output |
| 2 | `echo` | CLI args, `std::env` |
| 3 | `cat` | File I/O, `BufReader`, iterators |
| 4 | `head` | Slices, byte vs. char |
| 5 | `wc` | Counting, structs |
| 6 | `uniq` | Ownership in loops |
| 7 | `find` | Recursion, `walkdir` crate |
| 8 | `cut` | String splitting, `csv` crate |
| 9 | `grep` | Regex, `regex` crate |
| 10–14 | `comm`, `tail`, `fortune`, `cal`, `ls` | Advanced patterns |

## Note

Recommends reading *Programming Rust* and *The Rust Book* alongside it for deeper language coverage.
