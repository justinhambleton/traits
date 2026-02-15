---
"@traits-dev/core": minor
"@traits-dev/cli": minor
---

Ship v1.5 voice-policy hardening updates focused on capability honesty and grounding.

- Add schema `v1.5` support with `capabilities` (`tools`, `constraints`, `handoff`) for explicit capability boundaries.
- Add validator check `S008` to warn on action-claiming behavioral policy language without matching declared tools.
- Add compiler `[CAPABILITY BOUNDARIES]` output block so compiled prompts include tools, constraints, and handoff policy.
- Regenerate showcase/docs content and reposition product language around voice and behavioral policy governance.
