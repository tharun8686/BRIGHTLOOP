# Performance evidence

Measured 31 October 2026. Separate generated demonstration database; no operational records were modified.

Dataset: 10,000 subscriptions, 10,000 invoices, 10,000 payments and 20,000 document lines. One customer and one plan. This does not model thousands of distinct customer/product selector options.

Machine: Windows, Node v24.19.0, Intel Core i7-13650HX, 20 logical processors, 24 GiB RAM. Local persistent SQLite WAL database. No network latency, concurrent traffic or browser hydration included.

Method: authenticated loopback HTTP GET, reading the complete streamed HTML body; Next.js development server; one warm-up then 20 sequential samples per route. Cold compilation is excluded. All tested representative requests were under two seconds, not a claim about every page or deployment.

| Route                                      | Median ms | p95 ms | Maximum ms |
| ------------------------------------------ | --------: | -----: | ---------: |
| /app                                       |     114.4 |  131.7 |      132.3 |
| /app/subscriptions?page=250                |     176.7 |  194.4 |      197.1 |
| /app/invoices?q=99&status=Confirmed&page=2 |     179.1 |  187.6 |      190.2 |
| /app/payments?page=250                     |     184.6 |  193.9 |      260.5 |

The payment page initially loaded all confirmed invoices into its selector (maximum 1,306 ms). It now loads 100 recent confirmed invoices; any older invoice can be paid from its own detail page. Final values above reflect that optimization.

Service-only samples: one warm-up and 50 sequential calls. Subscription list p95 23.7 ms, invoice search p95 14.7 ms and dashboard p95 28.7 ms. Searches execute in SQL; name substring search is not an index seek. Status, ownership and billing-date indexes support their corresponding filters.

Reproduce with:

```sh
node --require ./scripts/test-register.cjs scripts/benchmark.ts
node --require ./scripts/test-register.cjs scripts/http-benchmark.ts
```

Raw local results are in tmp/benchmark-results.json and tmp/http-benchmark-results.json (gitignored). Repeat on the actual production machine with production mode, realistic catalog diversity, concurrent requests and cold-start measurements before making broader performance claims.
