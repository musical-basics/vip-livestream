<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Workflow

Push after every change. After completing any code or documentation change, commit it and run `git push` before finishing the turn.

For recreating agent API logic based on UI logic:
Extract the logic behind this UI into an API endpoint. The UI must call it through the existing function signature unchanged. Do not modify how the UI invokes it. The function's inputs and outputs must stay identical so the UI behaves exactly as it does now.
