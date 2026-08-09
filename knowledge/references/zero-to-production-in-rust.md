---
type: Runbook
title: Zero to Production in Rust (Palmieri)
description: End-to-end guide to building and shipping a production Rust web API — project-driven and opinionated
why: Shows what real-world Rust projects look like at production scale; raises the ceiling for learners who want to go beyond toy programs
resource: https://www.zero2prod.com/
tags: [rust, learning, web, production, projects]
timestamp: 2025-07-15
source_system: Public docs
access_state: linked
sensitivity: public
---

# Zero to Production in Rust

By Luca Palmieri. Available at <https://www.zero2prod.com/>. Purchase required. Not freely available online.

## What it teaches

Builds a production email newsletter API from scratch using `actix-web`, `sqlx`, `tokio`, and `tracing`.
Covers: project setup, TDD in Rust, HTTP handlers, database integration, async patterns, error handling,
deployment (Docker, CI/CD), authentication, observability.

## When PAC should cite this

- When the learner's project involves a web API, HTTP server, or database
- When introducing async Rust in a real-world context (not just toy examples)
- When the learner asks about production patterns: structured logging, health checks, configuration management
- Cite as: "Chapter N of *Zero to Production in Rust* (Palmieri) covers this pattern in a real project."

## Key areas by chapter theme

| Theme | Rust concepts covered |
| --- | --- |
| Project setup | `cargo` workspace, CI setup, test organisation |
| HTTP with actix-web | Routing, extractors, middleware, async handlers |
| Database | `sqlx`, async queries, migrations, connection pooling |
| Error handling | Custom error types, `anyhow`, mapping errors across layers |
| Async | `tokio` runtime, spawning tasks, `Future` composition |
| Configuration | `config` crate, environment variables, typed config structs |
| Observability | `tracing`, structured JSON logs, request spans |
| Authentication | Password hashing, session management, `argon2` |
| Deployment | Docker multi-stage builds, environment parity |

## Note

Assumes working Rust knowledge. Best cited for learners who have completed a first project
and are starting something web/API-shaped.
