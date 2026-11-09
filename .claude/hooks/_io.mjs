// Shared I/O for Claude Code hooks: read the JSON event from stdin, answer per the hooks protocol.
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

export function readEvent() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export const projectDir = () => resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
export const relPath = (p) => (p ? relative(projectDir(), resolve(p)).split('\\').join('/') : '');

/** Block the tool call; `reason` is shown to Claude so it can self-correct. */
export function block(reason) {
  process.stderr.write(`${reason}\n`);
  process.exit(2);
}

/** Ask the human to confirm (PreToolUse only). */
export function ask(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
  process.exit(0);
}

/** Add context for Claude without blocking (PostToolUse / SessionStart / UserPromptSubmit). */
export function addContext(event, text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
  process.exit(0);
}
