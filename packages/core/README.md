# @traits-dev/core

Core SDK for traits.dev personality profiles: validate, compile, inject, and evaluate.

## Install

```bash
pnpm add @traits-dev/core
```

## Basic Usage

```ts
import { compileProfile, validateProfile } from "@traits-dev/core";

const profilePath = "profiles/resolve.yaml";
const validation = validateProfile(profilePath);
if (validation.exitCode !== 0) throw new Error("Invalid profile");

const compiled = compileProfile(profilePath, {
  model: "gpt-4o",
  bundledProfilesDir: "profiles",
  knowledgeBaseDir: "knowledge-base"
});

console.log(compiled.text);
```

Public API is exported from `@traits-dev/core`. Monorepo/internal helpers are exported from `@traits-dev/core/internal`.
