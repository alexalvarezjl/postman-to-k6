# Workflow: Test-Driven Development (TDD) Feature Implementation

This workflow guides you through implementing a new feature or fixing a bug in the Postman-to-k6 converter using a Test-Driven Development approach.

## Steps

### Step 1: Define Test Cases
1. Identify the inputs (Postman Collection JSON or cURL command) and outputs (expected k6 JS script, Cypress JS/TS script).
2. Document the specifications in a test plan or list.

### Step 2: Create a Failing Test (RED)
1. Add a test in `cypress/e2e/` covering the new functionality.
2. Run the Cypress test runner using:
   ```bash
   npx cypress run --spec "cypress/e2e/..."
   ```
3. Verify that the test fails exactly as expected.

### Step 3: Implement Minimal Production Code (GREEN)
1. Modify `converter.js`, `curl-parser.js`, `app.js` or the generator files to support the new features.
2. Run the Cypress test again.
3. Iterate until the tests pass successfully.

### Step 4: Refactor and Verify
1. Review code aesthetics, structure, style variables, naming conventions, and clean up.
2. Re-run tests to verify everything is green.
