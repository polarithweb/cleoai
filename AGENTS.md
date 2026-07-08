# Polarith Software Agent Guidelines

## Critical Model Rules & Constraints

- **Polarith Amabie 1.0 (`amabie`)**:
  - **MANDATORY MODEL ID**: Must **always** and **exclusively** run on **`openai/gpt-oss-120b`** via Groq.
  - **DO NOT CHANGE** this configuration under any circumstances unless explicitly instructed by the creator, Priyam Kesh.
  - This applies to both client-side fallbacks in `/src/utils/geminiClient.ts` and server-side routes in `/server.ts`.
