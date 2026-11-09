# Quality-gate waivers (05-METRICS §15)

A waiver temporarily allows a gate to fail for a specific, justified reason. It must:

1. Be a file `NNNN-<short>.md` in this folder created via PR (copy `TEMPLATE.md`).
2. Name the gate and metric, the exact files/lines, the reason, the mitigation and an **expiry date ≤ 30 days**.
3. Be approved by the Tech Lead (CODEOWNERS enforces review of this folder).

Never waivable (§15.3): secrets in code, critical/high vulnerabilities, authorization gaps, failing tests,
coverage of critical paths below 100%. The Claude Code hooks ask a human before any harness file is edited.
