import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";

import { validateProfile } from "@traits-dev/core";

const TONE_PRESETS = {
  balanced: {
    formality: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    warmth: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    verbosity: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    directness: "medium",
    empathy: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    humor: { target: "very-low", style: "none" }
  },
  warm: {
    formality: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    warmth: { target: "high", adapt: true, floor: "medium", ceiling: "very-high" },
    verbosity: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    directness: "medium",
    empathy: { target: "high", adapt: true, floor: "medium", ceiling: "very-high" },
    humor: { target: "very-low", style: "none" }
  },
  direct: {
    formality: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    warmth: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    verbosity: { target: "low", adapt: true, floor: "low", ceiling: "medium" },
    directness: "high",
    empathy: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    humor: { target: "very-low", style: "none" }
  },
  formal: {
    formality: { target: "high", adapt: true, floor: "medium", ceiling: "very-high" },
    warmth: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    verbosity: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    directness: "medium",
    empathy: { target: "medium", adapt: true, floor: "low", ceiling: "high" },
    humor: { target: "very-low", style: "none" }
  }
};

function printInitUsage(out = process.stderr) {
  out.write(
    [
      "Usage:",
      "  traits init [output-path] [options]",
      "",
      "Options:",
      "  --name <name>             Profile name",
      "  --domain <domain>         Domain or vertical",
      "  --model <model>           Primary model target metadata (tag only)",
      "  --tone <tone>             Tone preset: balanced|warm|direct|formal",
      "  --template <profile>      Start from a starter profile (e.g., resolve)",
      "  --verbose                 Include additional command metadata",
      "  --no-color                Disable colorized output",
      "  --force                   Overwrite output file if it exists",
      ""
    ].join("\n")
  );
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toTitleWords(value) {
  return String(value)
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function renderDimensionBlock(key, value) {
  if (typeof value === "string") {
    return [`  ${key}: "${value}"`];
  }
  const lines = [`  ${key}:`];
  lines.push(`    target: "${value.target}"`);
  if (value.adapt != null) lines.push(`    adapt: ${value.adapt ? "true" : "false"}`);
  if (value.floor != null) lines.push(`    floor: "${value.floor}"`);
  if (value.ceiling != null) lines.push(`    ceiling: "${value.ceiling}"`);
  if (value.style != null) lines.push(`    style: "${value.style}"`);
  return lines;
}

function renderScaffold({ name, domain, model, tone }) {
  const domainLabel = String(domain).trim();
  const preset = TONE_PRESETS[tone] ?? TONE_PRESETS.balanced;
  const role = `${toTitleWords(domainLabel)} assistant`;
  const expertise = `${toTitleWords(domainLabel)} workflows and support`;

  return [
    '# traits.dev personality scaffold',
    '# Edit fields to match your product and voice requirements.',
    'schema: "v1.4"',
    "",
    "meta:",
    `  name: "${name}"`,
    '  version: "1.0.0"',
    `  description: "${toTitleWords(domainLabel)} assistant profile scaffold"`,
    "  tags:",
    `    - "${slugify(domainLabel) || "general"}"`,
    `    - "model:${model}"`,
    '  target_audience: "Users who need reliable help"',
    "",
    "identity:",
    `  role: "${role}"`,
    "  backstory: >",
    "    You are a practical, trustworthy assistant that helps users",
    "    complete tasks with clear next steps and explicit boundaries.",
    "  expertise_domains:",
    `    - "${expertise}"`,
    "",
    "voice:",
    "  # Levels: very-low | low | medium | high | very-high",
    ...renderDimensionBlock("formality", preset.formality),
    ...renderDimensionBlock("warmth", preset.warmth),
    ...renderDimensionBlock("verbosity", preset.verbosity),
    ...renderDimensionBlock("directness", preset.directness),
    ...renderDimensionBlock("empathy", preset.empathy),
    ...renderDimensionBlock("humor", preset.humor),
    "",
    "vocabulary:",
    "  preferred_terms:",
    '    - "Here\'s what I can do"',
    "  forbidden_terms:",
    '    - "always"',
    "",
    "behavioral_rules:",
    '  - "Answer with concrete steps before optional background details"',
    '  - "State uncertainty explicitly when information is incomplete"',
    "",
    "context_adaptations:",
    '  - when: "frustrated_user"',
    "    adjustments:",
    "      warmth:",
    '        target: "high"',
    "        adapt: false",
    "    inject:",
    '      - "Acknowledge frustration first, then provide one clear next step"',
    "",
    "# Reserved sections for future use:",
    "# localization: {}",
    "# channel_adaptations: {}",
    ""
  ].join("\n");
}

function parseInitArgs(args) {
  const result = {
    outputPath: null,
    name: null,
    domain: null,
    model: null,
    tone: null,
    template: null,
    verbose: false,
    noColor: false,
    force: false
  };

  const positionals = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--force") {
      result.force = true;
      continue;
    }
    if (arg === "--verbose") {
      result.verbose = true;
      continue;
    }
    if (arg === "--no-color") {
      result.noColor = true;
      continue;
    }
    if (arg === "--name" || arg === "--domain" || arg === "--model" || arg === "--tone" || arg === "--template") {
      const value = args[index + 1];
      if (!value) return { error: `Missing value for "${arg}"` };
      const key = arg.slice(2);
      result[key] = value;
      index += 1;
      continue;
    }
    if (arg.startsWith("--")) {
      return { error: `Unknown option "${arg}"` };
    }
    positionals.push(arg);
  }

  if (positionals.length > 1) {
    return { error: "Expected at most one output path argument" };
  }
  result.outputPath = positionals[0] ?? null;

  if (result.tone && !Object.hasOwn(TONE_PRESETS, result.tone)) {
    return {
      error: `Invalid tone "${result.tone}". Expected one of: ${Object.keys(TONE_PRESETS).join(", ")}`
    };
  }

  return { value: result };
}

function resolveTemplatePath(template, cwd) {
  const candidateValues = [template];
  if (!template.endsWith(".yaml")) {
    candidateValues.push(`${template}.yaml`);
  }

  for (const candidate of candidateValues) {
    const absoluteCandidate = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(cwd, candidate);
    if (fs.existsSync(absoluteCandidate)) return absoluteCandidate;
    const starterCandidate = path.resolve(cwd, "profiles", candidate);
    if (fs.existsSync(starterCandidate)) return starterCandidate;
  }
  return null;
}

async function promptIfMissing(config, io) {
  const out = { ...config };
  if (!io.stdin.isTTY || !io.stdout.isTTY) {
    out.name = out.name ?? "my-profile";
    out.domain = out.domain ?? "general-assistant";
    out.model = out.model ?? "claude-sonnet";
    out.tone = out.tone ?? "balanced";
    return out;
  }

  const rl = readline.createInterface({ input: io.stdin, output: io.stdout });
  try {
    const nameInput = out.name ?? (await rl.question("Profile name (my-profile): "));
    out.name = nameInput.trim() || "my-profile";

    const domainInput =
      out.domain ?? (await rl.question("Domain or vertical (general-assistant): "));
    out.domain = domainInput.trim() || "general-assistant";

    const modelInput = out.model ?? (await rl.question("Model target tag (claude-sonnet): "));
    out.model = modelInput.trim() || "claude-sonnet";

    const toneInput =
      out.tone ??
      (await rl.question("Tone preset [balanced|warm|direct|formal] (balanced): "));
    out.tone = toneInput.trim() || "balanced";
    if (!Object.hasOwn(TONE_PRESETS, out.tone)) {
      out.tone = "balanced";
    }
  } finally {
    rl.close();
  }
  return out;
}

function resolveOutputPath(cwd, options) {
  if (options.outputPath) return path.resolve(cwd, options.outputPath);
  if (options.template) {
    const base = slugify(path.basename(options.template, path.extname(options.template)));
    return path.resolve(cwd, `${base || "profile"}-custom.yaml`);
  }
  return path.resolve(cwd, `${slugify(options.name) || "profile"}.yaml`);
}

function ensureWritableTarget(filePath, force) {
  if (!fs.existsSync(filePath)) return { ok: true };
  if (force) return { ok: true };
  return {
    ok: false,
    message: `File already exists: ${filePath}. Use --force to overwrite.`
  };
}

function writeFileAtomic(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempFile = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`
  );
  fs.writeFileSync(tempFile, contents, "utf8");
  fs.renameSync(tempFile, filePath);
}

export async function runInit(args, io = process) {
  const parsed = parseInitArgs(args);
  if (parsed.error) {
    io.stderr.write(`Error: ${parsed.error}\n\n`);
    printInitUsage(io.stderr);
    return 1;
  }

  let options = parsed.value;
  const cwd = io.cwd();

  if (options.template) {
    const templatePath = resolveTemplatePath(options.template, cwd);
    if (!templatePath) {
      io.stderr.write(`Error: Unable to resolve template "${options.template}"\n`);
      return 1;
    }

    const outputPath = resolveOutputPath(cwd, options);
    const writableCheck = ensureWritableTarget(outputPath, options.force);
    if (!writableCheck.ok) {
      io.stderr.write(`Error: ${writableCheck.message}\n`);
      return 1;
    }

    const templateContent = fs.readFileSync(templatePath, "utf8");
    writeFileAtomic(outputPath, templateContent);
    if (options.verbose) {
      io.stdout.write(`Template source: ${templatePath}\n`);
    }
    io.stdout.write(`Created profile from template at ${outputPath}\n`);
    return 0;
  }

  options = await promptIfMissing(options, io);
  const outputPath = resolveOutputPath(cwd, options);
  const writableCheck = ensureWritableTarget(outputPath, options.force);
  if (!writableCheck.ok) {
    io.stderr.write(`Error: ${writableCheck.message}\n`);
    return 1;
  }

  const content = renderScaffold({
    name: options.name ?? "my-profile",
    domain: options.domain ?? "general-assistant",
    model: options.model ?? "claude-sonnet",
    tone: options.tone ?? "balanced"
  });
  writeFileAtomic(outputPath, content);
  if (options.verbose) {
    io.stdout.write(
      `Scaffold config: name=${options.name ?? "my-profile"}, domain=${
        options.domain ?? "general-assistant"
      }, model=${options.model ?? "claude-sonnet"}, tone=${options.tone ?? "balanced"}\n`
    );
  }

  const validation = validateProfile(outputPath, {
    bundledProfilesDir: path.resolve(cwd, "profiles")
  });
  if (validation.errors.length > 0) {
    io.stderr.write(
      `Error: Generated profile failed validation (${validation.errors.length} errors).\n`
    );
    return 2;
  }

  io.stdout.write(`Created profile scaffold at ${outputPath}\n`);
  if (validation.warnings.length > 0) {
    io.stdout.write(`Validation warnings: ${validation.warnings.length}\n`);
  }
  return 0;
}

export function initHelp(out = process.stdout) {
  printInitUsage(out);
}

export function defaultInitOutputDir() {
  return path.join(os.tmpdir(), "traits-init");
}
