import { readFileSync, writeFileSync } from 'node:fs'

const DEFAULT_WORKER_NAME = 'lazy-shopping-list'
const PREVIEW_TURNSTILE_SITE_KEY = '1x00000000000000000000BB'
const PREVIEW_TURNSTILE_SECRET = '1x0000000000000000000000000000000AA'

export function previewWorkerName(prNumber, baseName = DEFAULT_WORKER_NAME) {
  const normalized = String(prNumber)
  if (!/^\d+$/.test(normalized)) {
    throw new Error('PR number must contain only digits')
  }
  return `${baseName}-pr-${normalized}`
}

export function createPreviewConfig(sourceConfig, prNumber, options = {}) {
  const config = structuredClone(sourceConfig)
  config.name = previewWorkerName(prNumber, sourceConfig.name || DEFAULT_WORKER_NAME)
  config.workers_dev = true

  if (options.vars && Object.keys(options.vars).length > 0) {
    config.vars = { ...config.vars, ...options.vars }
  }

  delete config.route
  delete config.routes
  delete config.domain
  delete config.domains
  delete config.custom_domain

  return config
}

export function parseJsonc(input) {
  return JSON.parse(stripJsonc(input))
}

function stripJsonc(input) {
  let output = ''
  let inString = false
  let escaped = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]
    const next = input[i + 1]

    if (inString) {
      output += char
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }

    if (char === '"') {
      inString = true
      output += char
      continue
    }

    if (char === '/' && next === '/') {
      while (i < input.length && input[i] !== '\n') i += 1
      output += '\n'
      continue
    }

    if (char === '/' && next === '*') {
      i += 2
      while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i += 1
      i += 1
      continue
    }

    output += char
  }

  return output.replace(/,\s*([}\]])/g, '$1')
}

function runCli(argv) {
  const [prNumber, ...args] = argv
  if (!prNumber) {
    throw new Error(
      'Usage: node scripts/pr-preview-config.js <pr-number> [--source wrangler.jsonc] [--out wrangler.preview.json]',
    )
  }

  const sourcePath = optionValue(args, '--source') || 'wrangler.jsonc'
  const outPath = optionValue(args, '--out') || 'wrangler.preview.json'
  const sourceConfig = parseJsonc(readFileSync(sourcePath, 'utf8'))
  const vars = previewVars(prNumber, process.env)
  const previewConfig = createPreviewConfig(sourceConfig, prNumber, { vars })
  writeFileSync(outPath, `${JSON.stringify(previewConfig, null, 2)}\n`)
  console.log(previewConfig.name)
}

export function previewVars(prNumber, env = process.env) {
  return {
    TURNSTILE_SITE_KEY: env.TURNSTILE_SITE_KEY || PREVIEW_TURNSTILE_SITE_KEY,
    TURNSTILE_SECRET: env.TURNSTILE_SECRET || PREVIEW_TURNSTILE_SECRET,
    SESSION_HMAC_SECRET: env.SESSION_HMAC_SECRET || `preview-session-secret-pr-${prNumber}`,
  }
}

function optionValue(args, name) {
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2))
}
