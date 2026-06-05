# Product Objective

## One-Sentence Objective

Prove a tool-search pattern that lets an agent use a large tool registry without sending every tool schema to the model on every turn.

## Core Thesis

Modern agents can accumulate dozens or hundreds of tools. Exposing all of them all the time is expensive, noisy, and likely harmful to tool choice quality.

This project exists to test a better pattern:

- keep a large registry of available tools
- decide per turn whether tools are needed at all
- expose only 0-10 directly relevant tools to the main agent
- provide a recovery path when the selector misses
- make the token savings and routing decisions visible

## What This Repo Is

This repo is a controlled local experiment, not the final real-world integration.

The tools are intentionally mock-backed but realistic at the schema layer. Their job is to create a large, measurable tool surface with believable tool names, descriptions, and input parameters while keeping execution deterministic and local.

The app should make it easy to compare:

- all tools exposed vs routed tools exposed
- prompt tokens spent on tool schemas
- per-tool schema size
- which tools were selected
- why those tools were selected
- when no tools were sent
- when recovery search was needed

## Current Scaffold

The app is currently a Next.js chat surface using OpenRouter and the Vercel AI SDK. That chat surface is the test harness for tool-routing experiments.

Existing side quests like token usage display, reasoning display, and prompt allocation breakdown are supporting instrumentation. They matter because they help prove whether tool search actually reduces cost and preserves behavior.

## Target Behavior

For each user turn:

1. Decide whether the turn needs tools.
2. If no tools are needed, send 0 tools.
3. If tools are likely needed, select 1-10 direct tools from a compact tool index.
4. If selection confidence is low, include a small recovery/search tool.
5. Run the main agent with only that routed tool surface.
6. Show the routing decision and token impact in the UI.

## Success Criteria

The project is successful when it can demonstrate:

- no-tool turns actually send 0 tool schemas
- tool-using turns send only a small selected subset
- the UI shows selected tools and selection reasons
- the UI shows omitted/all-tool cost for comparison
- per-tool schema cost is visible
- the selector has a recovery path for missed tools
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
