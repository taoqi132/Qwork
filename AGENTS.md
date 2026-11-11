# Qwork development instructions

- Preserve the original Meldwork source; this is an independent Qwork checkout.
- Use TypeScript for new application logic; keep legacy runtime modules attributed and mark modifications.
- Keep supported agent kinds constrained to Codex, Claude Code, WorkBuddy, Zcode, OpenClaw and Qwen Code.
- Do not parse attachment contents in Qwork. Manage copies, paths and byte fingerprints; the CLI reads content.
- Freeze run settings and parallel contexts; group display names must not enter prompts.
- Never infer approval from missing receipts or apply approval to a changed candidate/file version.
- Keep write authorization visible and explicit on group creation (checked by default per product requirements), a single production writer, and independent read-only review.
- Keep credentials and executable selection out of the renderer. Validate IPC with Zod and verify frame identity.
- Do not recursively delete user workspaces when removing chat history.
- Run npm run typecheck, npm test, npm run build and relevant legacy tests. Use npm run smoke for actual Electron UI acceptance; it uses isolated test data and mock responses.
- Store intermediate logs/screenshots/test data in work/, not the repository root. Never commit node_modules, release packages, user sessions or credentials.
