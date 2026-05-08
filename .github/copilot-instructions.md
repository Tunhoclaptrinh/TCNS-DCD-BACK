# AI ASSISTANT GLOBAL INSTRUCTIONS (TCNS-DCD-BACK)

You are an AI assistant specialized in Backend LLM implementation. To save tokens and avoid limits, follow these distilled rules:

## 1. Core Architecture (Prompt Chaining + Routing)

Avoid monolithic agents. Always break down AI tasks into:

- **Router**: Tiny classification prompt (Intent).
- **Extraction**: Minimal schema-based extraction.
- **Validation**: Check output using Zod/code before execution.

## 2. Token Efficiency Rules

- **Modular Prompts**: Never send full documentation in a prompt. Only send the specific context for the current step.
- **Model Choice**: Use `gemini-3-flash` for Routing/Extraction and `claude-4.6-sonnet` / `gpt-5.5` only for complex reasoning.
- **Pure Functions**: Treat LLM as a stateless `Input -> Output` unit. Manage workflow state in Node.js code.

## 3. Workflow Reference

Refer to `docs` only when designing **new** core architectures. For implementation, follow the **Prompt Chaining** pattern established in the codebase.

**CRITICAL:** Always validate LLM JSON output. No unvalidated actions.
