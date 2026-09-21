# CAB System API YAML Test Pack — OpenAPI 3.0.3

## Structure

- 17 standalone OpenAPI YAML files: one file per BR01–BR17.
- `coverage-report.yaml`: consolidated coverage/validation report.
- Every BR file is directly importable as an OpenAPI document into Swagger UI.

## OpenAPI shape

Every BR file starts with:

```yaml
openapi: 3.0.3
info:
  title: ...
  version: ...
servers:
  - url: http://localhost:3000
paths:
  ...
components:
  ...
```

## Swagger UI

1. Start `cab_backend_nodejs`.
2. Open Swagger UI and import one BR YAML file.
3. Click **Authorize** and enter the JWT token for protected endpoints.
4. Click an endpoint → **Try it out** → fill path parameters/body → **Execute**.

Default server:
`http://localhost:3000`

Change `servers.url` if the backend uses another host/port.

## Important source constraint

The existing test pack already contains the API `method`/`path` mapping. This conversion preserves those mappings.

Where the source test pack says `IMPLEMENTATION_MAPPING_REQUIRED`, that marker is preserved as:

```yaml
x-implementation-status: IMPLEMENTATION_MAPPING_REQUIRED
```

No additional HTTP route is silently substituted.

## Request body

The source SRS/test workbook does not define a complete JSON schema for every endpoint. Therefore, POST/PUT/PATCH operations use:

```yaml
type: object
additionalProperties: true
```

This is deliberate. It makes Swagger UI usable for manual API testing without inventing a false request contract.

## Test traceability

Each operation contains:

```yaml
x-test-cases:
  - testCaseId: ...
    scenario: ...
    testData: ...
    expectedResult: ...
```

So the Swagger endpoint and the corresponding Excel test case remain traceable.

## Validation

Generated:
- 17 OpenAPI 3.0.3 BR files
- 195 unique Test Case IDs
- 0 duplicate IDs
- 0 missing IDs
- 40 API operations
