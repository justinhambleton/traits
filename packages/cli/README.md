# @traits-dev/cli

CLI for traits.dev profile workflows: init, validate, compile, eval, and import.

## Install

```bash
pnpm add -D @traits-dev/cli
```

## Basic Usage

```bash
traits init --template resolve profiles/resolve.yaml
traits validate profiles/resolve.yaml
traits compile profiles/resolve.yaml --model gpt-4o
traits eval profiles/resolve.yaml --tier 1
```

You can also run it without local install:

```bash
npx @traits-dev/cli validate profiles/resolve.yaml
```

For programmatic usage, use `@traits-dev/core`.
