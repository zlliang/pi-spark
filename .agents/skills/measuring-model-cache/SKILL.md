---
name: measuring-model-cache
description: Measures model prompt-cache hits, latency, and response-chain correctness across session topologies. Use when testing whether same-session, cross-session, or background model calls such as title and recap affect a main agent thread's cache behavior.
---

# Measuring Model Cache

Measure the next main turn after a controlled cache warm-up. Change one session variable at a time.

## Method

For each scenario:

1. Send a long prompt with a namespace chosen for the scenario: reuse it to test cross-session sharing; otherwise make it unique
2. Wait for the first response
3. Optionally run the background or cross-session call under test
4. Send an identical short follow-up in the main session
5. Record the second main response's usage, latency, stop reason, and error
6. Repeat at least three times, alternating control and treatment order

Calculate:

```text
prompt = input + cacheRead + cacheWrite
hit rate = cacheRead / prompt
impact = treatment hit rate - control hit rate
```

Treat any `previous_response_id` or continuation error as a correctness failure, regardless of hit rate.

## Session scenarios

- **Same session:** warm and probe within one session
- **Cross session:** warm in one session and probe the same prefix in another to test provider-wide reuse
- **Isolated sessions:** use different prefix namespaces to prevent accidental cross-session warming
- **Background call:** insert title, recap, summary, or classifier generation between two main turns
- **Shared identity:** deliberately reuse a session ID to test connection or continuation coupling

Use the same namespace only when testing cross-session cache sharing. Otherwise put a unique namespace near the start of each prefix; identical prompts can warm provider caches across nominally independent sessions.

## pi-spark title and recap probe

The bundled RPC probe compares a control with the feature disabled against the real title or recap path from the current checkout:

```bash
# title with the same model as the main thread
uv run --script scripts/measure.py title openai-codex gpt-5.6-luna --runs 3

# recap with the same model as the main thread
uv run --script scripts/measure.py recap openai-codex gpt-5.6-luna --runs 3

# recap with a different background model
uv run --script scripts/measure.py recap openai-codex gpt-5.6-sol \
  --feature-provider openai-codex \
  --feature-model gpt-5.6-luna \
  --runs 5
```

It emits CSV rows and verifies that each treatment actually wrote the expected custom entry.

## Interpretation

- Compare only the second **main** response; background usage is a separate cost measurement
- Sum all prompt token categories because providers account for caching differently
- Report latency separately from hit rate; connection reuse can change one without changing the other
- Increase `--prefix-chars` when all cache reads are zero
- Test multiple providers after changing shared model-call code
- Re-run after Pi or provider upgrades; cache admission and session routing are not stable contracts
