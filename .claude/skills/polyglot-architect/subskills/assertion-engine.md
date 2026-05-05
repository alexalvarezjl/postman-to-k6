# Assertion Engine: Semantic Translation

This subskill provides rules for translating Postman's `pm.expect` and `pm.test` patterns into a semantic JSON structure within the IOI.

## The Goal
Instead of passing raw JavaScript strings to generators, we provide a list of assertion objects that generators can easily map to their own syntax (e.g., `check()` in k6, `expect()` in Cypress).

## Target Schema (Proposed)
Add an `assertions` array to each request in the IOI:
```json
{
  "assertions": [
    {
      "name": "Status is 200",
      "type": "status",
      "operator": "eq",
      "value": 200,
      "raw": "pm.response.to.have.status(200)"
    }
  ]
}
```

## Mapping Patterns

| Postman Pattern | Type | Operator | Value |
| :--- | :--- | :--- | :--- |
| `pm.response.to.have.status(X)` | `status` | `eq` | `X` |
| `pm.expect(pm.response.responseTime).to.be.below(X)` | `responseTime` | `lt` | `X` |
| `pm.expect(pm.response.headers.get('Content-Type')).to.include(X)` | `header` | `contains` | `{key: 'Content-Type', val: X}` |
| `pm.expect(data.X).to.eql(Y)` | `bodyPath` | `eq` | `{path: 'X', val: Y}` |

## Implementation Strategy in `converter.js`
1. Use Regex to identify common patterns in the `exec` array of the test event.
2. For each match, create a semantic object.
3. Keep the original `postmanScript` for fallback or manual review comments in generators.
