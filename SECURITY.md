# Security Policy

## Supported versions

This project is currently pre-1.0. We support security fixes on the latest published minor line.

| Version line | Supported |
| --- | --- |
| `0.4.x` | Yes |
| `< 0.4.0` | No |

## Reporting a vulnerability

Please do not open public GitHub issues for security vulnerabilities.

Use GitHub private vulnerability reporting:

- [Report a vulnerability](https://github.com/justinhambleton/traits/security/advisories/new)

If private reporting is unavailable for any reason, open a minimal issue that asks maintainers to contact you and avoid posting exploit details.

## What to include in a report

- Affected package(s): `@traits-dev/core`, `@traits-dev/cli`, or docs/workflow
- Affected version(s)
- Reproduction steps or proof-of-concept
- Expected behavior vs actual behavior
- Impact assessment
- Suggested mitigation (if available)

## Response and disclosure

- We will acknowledge reports as quickly as possible.
- We will validate, triage severity, and work on a fix.
- We will coordinate disclosure timing with the reporter when appropriate.
- When fixed, we will publish patched releases and changelog notes.

## Scope notes

Reports are especially valuable for:

- Validator or merge behavior that bypasses safety checks (`S001`-`S008`)
- Prompt/policy injection pathways
- Inheritance/composition regressions affecting locked or safety constraints
- Release pipeline or trusted publishing misconfiguration
