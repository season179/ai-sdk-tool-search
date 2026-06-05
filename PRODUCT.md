# Product Objective

## One-Sentence Objective

Prove a tool-search pattern that lets an agent use a large tool registry without sending every tool schema to the model on every turn.

## Core Thesis

Modern agents can accumulate dozens or hundreds of tools. Exposing all of them all the time is expensive, noisy, and likely harmful to tool choice quality.

This project exists to test a better pattern:

- keep a large registry of available tools
- expose a tiny search/describe/call bridge instead of every schema
- let the model discover and invoke deferred tools on demand
- keep an all-tools baseline for comparison
- make the token savings and routing decisions visible

## What This Repo Is

This repo is a controlled local experiment, not the final real-world integration.

The tools are intentionally mock-backed but realistic at the schema layer. Their job is to create a large, measurable tool surface with believable tool names, descriptions, and input parameters while keeping execution deterministic and local.

The app should make it easy to compare:

- all tools exposed vs search bridge exposed
- prompt tokens spent on tool schemas
- per-tool schema size
- which tools were searched, described, and called
- how much schema cost was deferred
- when the bridge failed to find or call a tool

## Current Scaffold

The app is currently a Next.js chat surface using OpenRouter and the Vercel AI SDK. That chat surface is the test harness for tool-routing experiments.

Existing side quests like token usage display, reasoning display, and prompt allocation breakdown are supporting instrumentation. They matter because they help prove whether tool search actually reduces cost and preserves behavior.

## Target Behavior

For each user turn:

1. Keep the full tool catalog server-side.
2. Send only `tool_search`, `tool_describe`, and `tool_call` to the model.
3. Let the model search the catalog when it needs a deferred capability.
4. Return full schema for one selected tool through `tool_describe`.
5. Invoke the underlying mock-backed tool through `tool_call`.
6. Show the search trace and token impact in the UI.

## Success Criteria

The project is successful when it can demonstrate:

- search mode sends only the bridge schemas
- all-tools mode remains available as a baseline
- the UI shows searched, described, and called tools
- the UI shows deferred/all-tool cost for comparison
- per-tool schema cost is visible
- the bridge has a recovery path for missed tools
- total token usage drops substantially compared with exposing all tools
- behavior remains understandable and debuggable

## Non-Goals For Now

- The mock-backed tools do not need to perform useful real-world work.
- The UI does not need to become a production dashboard.
- The first version does not need provider-native tool search.
- The first version does not need embeddings or a complex reranker.
- This repo does not need to solve permissions, auth, or real MCP integration yet.

## Later Migration Concerns

When this pattern is applied to a real project, the hard parts will be:

- tool metadata quality
- permission and session scoping
- recovery when the wrong tools are selected
- evals for selector accuracy
- observability for selected, omitted, searched, and called tools
- preserving prompt-cache behavior where the provider supports it

## Product Personality

Calm, precise, and evidential. The app should feel like a measurement instrument for agent behavior, not a marketing demo.

## Design Principles

- Put the conversation first.
- Make token and tool-routing state visible without making it loud.
- Prefer truthful runtime metadata over decorative labels.
- Keep copy short and concrete.
- Make every optimization explainable.
- Treat mock data as a controlled experiment, not fake product value.
