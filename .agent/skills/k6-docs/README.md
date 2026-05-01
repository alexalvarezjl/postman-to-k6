# k6-docs

[Agent Skill](https://agentskills.io) for accessing Grafana k6 documentation.

## Overview

References the latest official documentation when writing and debugging k6 load testing scripts.

## When to Use

- Creating new k6 test scripts
- Debugging existing k6 code
- Looking up k6 API methods
- Implementing metrics and thresholds

## Key Documentation URLs

| Topic | URL |
|-------|-----|
| Main Documentation | https://grafana.com/docs/k6/latest/ |
| JavaScript API | https://grafana.com/docs/k6/latest/javascript-api/ |
| HTTP Module | https://grafana.com/docs/k6/latest/javascript-api/k6-http/ |
| Examples | https://grafana.com/docs/k6/latest/examples/ |

## Basic k6 Test Example

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const res = http.get('https://test.k6.io');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

## Details

See [SKILL.md](SKILL.md) for detailed patterns and documentation search strategies.
