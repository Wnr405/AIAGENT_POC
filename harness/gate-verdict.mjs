// Pure verdict for harness/gate.mjs (05-METRICS §11) — kept side-effect free so it can be unit-tested.
export const SKIPPED_NO_DEPS = 'SKIPPED (run pnpm install)';

/**
 * A FAIL always fails the gate. A step skipped because dependencies are missing also fails it —
 * an unverified gate must not look green — unless the caller opts in with `--allow-skip`.
 * @param {[string, string][]} results @param {{ allowSkip?: boolean }} [opts] @returns {0 | 1}
 */
export function gateExitCode(results, { allowSkip = false } = {}) {
  const failed = results.some(([, s]) => s === 'FAIL' || (!allowSkip && s === SKIPPED_NO_DEPS));
  return failed ? 1 : 0;
}

/**
 * pnpm is a `.cmd` shim on Windows and needs a shell; node (process.execPath) must not go through one,
 * because cmd.exe splits `C:\Program Files\nodejs\node.exe` at the space.
 * @param {string[]} cmd @param {NodeJS.Platform} platform
 */
export const needsShell = (cmd, platform) => platform === 'win32' && cmd[0] === 'pnpm';
