# API Reference

LabAnimal exposes a RESTful API built with [Hono](https://hono.dev/) for managing laboratory animal data.

## OpenAPI Specification

The full API specification is available as an OpenAPI 3.1 document:

- **Spec file**: [`packages/api/openapi.yaml`](https://github.com/anthropics/labanimal/blob/main/packages/api/openapi.yaml)
- **Swagger UI**: Available at `http://localhost:3000/docs` when the API server is running

## Base URL

```
http://localhost:3000/api
```

## Authentication

The API uses token-based authentication. Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/animals
```

## Endpoints

### Animals

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/animals` | List all animals |
| `GET` | `/animals/:id` | Get animal by ID |
| `POST` | `/animals` | Create a new animal |
| `PUT` | `/animals/:id` | Update an animal |
| `DELETE` | `/animals/:id` | Delete an animal |

### Cages

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/cages` | List all cages |
| `GET` | `/cages/:id` | Get cage by ID |
| `POST` | `/cages` | Create a new cage |
| `POST` | `/cages/assign` | Assign animal to cage (density-validated) |

### Rooms & Racks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rooms` | List all rooms |
| `GET` | `/racks` | List all racks |

### Breeding

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/breedings` | List breeding records |
| `POST` | `/breedings` | Create breeding record |

### Health & Medications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health-records` | List health records |
| `GET` | `/medications` | List medications |
| `POST` | `/medications` | Record medication administration |

### Death Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/death-reports` | List death reports |
| `POST` | `/death-reports` | Report an animal death |

### Protocols

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/protocols` | List IACUC protocols |
| `GET` | `/protocols/:id` | Get protocol by ID |
| `POST` | `/protocols` | Create a protocol |
| `POST` | `/protocols/:id/validate` | Run IACUC compliance check |

### Enrichments & Training

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/enrichments` | List enrichment records |
| `GET` | `/trainings` | List training records |

### Billing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/rates` | List per-diem rates |
| `GET` | `/billing` | Generate billing report |
| `GET` | `/work-sessions` | List work sessions |
| `GET` | `/batch-sessions` | List batch sessions |

### Audit & Signatures

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/audit-log` | Query audit trail |
| `POST` | `/electronic-signatures` | Create electronic signature |

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/login` | Authenticate and receive token |
| `POST` | `/auth/logout` | Invalidate token |

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "DENSITY_EXCEEDED",
    "message": "Cage density limit exceeded",
    "details": {
      "maxCount": 5,
      "currentCount": 5,
      "addingCount": 1
    }
  }
}
```

## Compliance Endpoints

When an operation would violate compliance rules, the API returns:

- **409 Conflict** — Density limit exceeded, AVMA violation, or IACUC violation
- **422 Unprocessable Entity** — Invalid protocol data
- **403 Forbidden** — Missing certification for euthanasia method
