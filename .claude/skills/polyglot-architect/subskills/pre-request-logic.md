# Pre-request Logic: Variable Management

This subskill handles the conversion of Postman Pre-request scripts, which are primarily used for dynamic variable setting and authentication preparation.

## Handling Strategy

1. **Extraction:**
   - In `normalizeRequest`, look for `e.listen === 'prerequest'`.
   - Extract the script into a new `preRequestScript` field in the IOI.

2. **Variable Detection:**
   - Detect `pm.environment.set("name", "value")` or `pm.variables.set(...)`.
   - Map these to a `dynamicVariables` list in the IOI.

3. **Generator Mapping:**
   - **k6:** Map to the `setup()` function or inline logic before the request.
   - **Cypress:** Map to `beforeEach()` or custom commands.
   - **Playwright:** Map to test hooks.

## Key Patterns to Detect
- `pm.environment.set(k, v)`
- `pm.globals.set(k, v)`
- `pm.collectionVariables.set(k, v)`
- `{{$guid}}`, `{{$timestamp}}`, `{{$randomInt}}` (Directly replace with native equivalents if possible).
