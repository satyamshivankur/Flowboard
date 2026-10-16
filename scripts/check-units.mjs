#!/usr/bin/env node
/**
 * Unit guard — Requirement 22.
 *
 * `rem` is this project's dimension unit. This script fails the build when `px`
 * appears where a dimension is authored, and allows it only in the four
 * documented exceptions:
 *
 *   1. Hairline borders, rings and dividers — a border is a rendering detail,
 *      not a layout dimension, and scaling one produces blurred sub-pixel edges.
 *   2. box-shadow offsets, blur and spread — cosmetic depth, not layout.
 *   3. dnd-kit sensor activation distance and touch tolerance — a pointer
 *      movement threshold in device pixels, never rendered.
 *   4. Raster asset intrinsic dimensions — a pixel count is correct for a pixel
 *      buffer.
 *
 * Run via `npm run lint:units`, and as part of `npm run lint`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const ROOT = process.cwd()
const SCAN_DIRS = ['src']
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.css'])

/** A line carrying this marker is an acknowledged exception. */
const ALLOW_MARKER = 'px-exception'

/** Lines matching these are structurally exempt. */
const EXEMPT_LINE_PATTERNS = [
  // box-shadow and text-shadow token declarations
  /--shadow-[\w-]*:/,
  /box-shadow|text-shadow|drop-shadow/,
  // dnd-kit sensor thresholds
  /activationConstraint|\bdistance:\s*\d|\btolerance:\s*\d/,
  // comments and prose — a doc comment may legitimately mention px
  /^\s*(\/\/|\/\*|\*)/,
]

/** Tailwind arbitrary values using px — always a failure. */
const ARBITRARY_PX = /(?:^|[\s"'`:])[a-z-]+-\[[^\]]*?\d(?:\.\d+)?px[^\]]*?\]/g

/** A dimensional CSS custom property declared in px. */
const TOKEN_PX = /--(?:size|spacing|radius|breakpoint|width|height)[\w-]*:\s*[^;]*\bpx\b/g

/** Any other px literal in a style-ish position. */
const GENERIC_PX = /\b\d+(?:\.\d+)?px\b/g

/** Overriding the root font size defeats the purpose of rem (22.8). */
const ROOT_FONT_OVERRIDE = /(?:^|\s)(?:html|:root)\s*\{[^}]*font-size\s*:/s

/* -------------------------------------------------------------------------- */
/* Breakpoint parity                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Tailwind owns breakpoints for styling, but a small amount of behaviour has to
 * observe one from JavaScript — the sidebar stops being a modal sheet at `lg`,
 * and a sheet left open while the viewport widens would become an invisible
 * focus trap. That forces the numbers to exist in two places.
 *
 * Duplication is only acceptable if drift is caught, so this compares the
 * `--breakpoint-*` tokens in the stylesheet against BREAKPOINT_REM in
 * src/config/breakpoints.ts. Checked here rather than in a Vitest test because
 * this script already runs in Node and reads source files, so it needs neither
 * Node types in the app tsconfig nor CSS processing enabled in Vitest.
 */

const STYLESHEET = 'src/index.css'
const BREAKPOINT_MODULE = 'src/config/breakpoints.ts'

function parseCssBreakpoints(source) {
  const found = {}

  for (const match of source.matchAll(/--breakpoint-([\w-]+):\s*([\d.]+)(\w+)\s*;/g)) {
    const [, name, value, unit] = match
    found[name] = { value: Number(value), unit }
  }

  return found
}

function parseTsBreakpoints(source) {
  const block = source.match(/BREAKPOINT_REM[^=]*=\s*\{([\s\S]*?)\}/)
  if (!block) return null

  const found = {}

  for (const match of block[1].matchAll(/["']?([\w-]+)["']?\s*:\s*([\d.]+)/g)) {
    found[match[1]] = Number(match[2])
  }

  return found
}

function checkBreakpointParity() {
  const problems = []

  let cssSource
  let tsSource

  try {
    cssSource = readFileSync(join(ROOT, STYLESHEET), 'utf8')
    tsSource = readFileSync(join(ROOT, BREAKPOINT_MODULE), 'utf8')
  } catch {
    // Neither file is required to exist; the parity check simply does not apply.
    return problems
  }

  const css = parseCssBreakpoints(cssSource)
  const ts = parseTsBreakpoints(tsSource)

  if (!ts) {
    problems.push(`${BREAKPOINT_MODULE}: could not find a BREAKPOINT_REM map to compare`)
    return problems
  }

  if (Object.keys(css).length === 0) {
    problems.push(`${STYLESHEET}: no --breakpoint-* tokens found`)
    return problems
  }

  for (const [name, { value, unit }] of Object.entries(css)) {
    if (unit !== 'rem') {
      problems.push(
        `${STYLESHEET}: --breakpoint-${name} is declared in ${unit}, must be rem (22.6)`,
      )
    }

    if (!(name in ts)) {
      problems.push(
        `${BREAKPOINT_MODULE}: missing "${name}", declared as ${String(value)}rem in ${STYLESHEET}`,
      )
    } else if (ts[name] !== value) {
      problems.push(
        `breakpoint "${name}" disagrees: ${STYLESHEET} says ${String(value)}${unit}, ` +
          `${BREAKPOINT_MODULE} says ${String(ts[name])}rem`,
      )
    }
  }

  for (const name of Object.keys(ts)) {
    if (!(name in css)) {
      problems.push(
        `${STYLESHEET}: missing --breakpoint-${name}, declared in ${BREAKPOINT_MODULE}`,
      )
    }
  }

  return problems
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue

    const full = join(dir, entry)

    if (statSync(full).isDirectory()) {
      walk(full, files)
    } else if (SCAN_EXTENSIONS.has(extname(full))) {
      files.push(full)
    }
  }

  return files
}

function isExempt(text) {
  if (text.includes(ALLOW_MARKER)) return true
  return EXEMPT_LINE_PATTERNS.some((pattern) => pattern.test(text))
}

/**
 * Groups source into logical units for scanning.
 *
 * CSS declarations wrap across lines — a prettier-formatted `--shadow-card`
 * with two shadow layers spans three lines — so scanning line by line would
 * flag the continuation lines while exempting only the first. Merging until the
 * terminating `;`, `{` or `}` keeps a declaration intact and attributes any
 * finding to the line it starts on.
 */
function logicalUnits(source, isCss) {
  const lines = source.split('\n')

  if (!isCss) {
    return lines.map((text, index) => ({ text, line: index + 1 }))
  }

  const units = []
  let buffer = ''
  let startLine = 1

  lines.forEach((line, index) => {
    if (buffer === '') startLine = index + 1
    buffer += (buffer === '' ? '' : ' ') + line.trim()

    if (/[;{}]\s*$/.test(line.trim()) || line.trim() === '') {
      units.push({ text: buffer, line: startLine })
      buffer = ''
    }
  })

  if (buffer !== '') units.push({ text: buffer, line: startLine })

  return units
}

function checkFile(file) {
  const violations = []
  const source = readFileSync(file, 'utf8')
  const isCss = file.endsWith('.css')

  if (isCss && ROOT_FONT_OVERRIDE.test(source)) {
    violations.push({
      file,
      line: 0,
      text: 'root font-size is overridden, which defeats rem sizing (22.8)',
      rule: 'root-font-size',
    })
  }

  for (const { text, line } of logicalUnits(source, isCss)) {
    if (isExempt(text)) continue

    const arbitrary = text.match(ARBITRARY_PX)
    if (arbitrary) {
      violations.push({
        file,
        line,
        text: arbitrary.join(', ').trim(),
        rule: 'arbitrary-value-px',
      })
      continue
    }

    const token = text.match(TOKEN_PX)
    if (token) {
      violations.push({
        file,
        line,
        text: token.join(', ').trim(),
        rule: 'dimensional-token-px',
      })
      continue
    }

    if (GENERIC_PX.test(text)) {
      violations.push({ file, line, text: text.trim(), rule: 'px-literal' })
    }

    GENERIC_PX.lastIndex = 0
  }

  return violations
}

const files = SCAN_DIRS.filter((dir) => {
  try {
    return statSync(join(ROOT, dir)).isDirectory()
  } catch {
    return false
  }
}).flatMap((dir) => walk(join(ROOT, dir)))

const violations = files.flatMap(checkFile)
const parityProblems = checkBreakpointParity()

if (violations.length === 0 && parityProblems.length === 0) {
  console.log(
    `✓ unit guard: ${String(files.length)} files, no px violations, breakpoints in sync`,
  )
  process.exit(0)
}

if (parityProblems.length > 0) {
  console.error(`\n✗ breakpoint parity: ${String(parityProblems.length)} problem(s)\n`)

  for (const problem of parityProblems) {
    console.error(`  ${problem}`)
  }

  console.error('')
}

if (violations.length === 0) {
  process.exit(1)
}

console.error(`\n✗ unit guard: ${String(violations.length)} px violation(s)\n`)

for (const violation of violations) {
  const location = `${relative(ROOT, violation.file)}:${String(violation.line)}`
  console.error(`  ${location}`)
  console.error(`    [${violation.rule}] ${violation.text}`)
}

console.error(
  `\n  Use rem, or a --size-* token. If this is one of the four documented\n` +
    `  exceptions in Requirement 22.4, annotate the line with "${ALLOW_MARKER}".\n`,
)

process.exit(1)
