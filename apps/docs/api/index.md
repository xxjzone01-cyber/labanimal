# API Reference

LabAnimal exposes a RESTful API built with [Hono](https://hono.dev/) for managing laboratory animal data.

## Base URL

```
http://localhost:3001/api
```

## Authentication

The API uses token-based authentication. Include the token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:3001/api/animals
```

## Endpoints

### Animals

| Method   | Endpoint       | Description         |
| -------- | -------------- | ------------------- |
| `GET`    | `/animals`     | List all animals    |
| `GET`    | `/animals/:id` | Get animal by ID    |
| `POST`   | `/animals`     | Create a new animal |
| `PUT`    | `/animals/:id` | Update an animal    |
| `DELETE` | `/animals/:id` | Delete an animal    |

### Cages

| Method | Endpoint        | Description                               |
| ------ | --------------- | ----------------------------------------- |
| `GET`  | `/cages`        | List all cages                            |
| `GET`  | `/cages/:id`    | Get cage by ID                            |
| `POST` | `/cages`        | Create a new cage                         |
| `POST` | `/cages/assign` | Assign animal to cage (density-validated) |

### Rooms & Racks

| Method | Endpoint | Description    |
| ------ | -------- | -------------- |
| `GET`  | `/rooms` | List all rooms |
| `GET`  | `/racks` | List all racks |

### Breeding

| Method | Endpoint     | Description            |
| ------ | ------------ | ---------------------- |
| `GET`  | `/breedings` | List breeding records  |
| `POST` | `/breedings` | Create breeding record |

### Health & Medications

| Method | Endpoint          | Description                      |
| ------ | ----------------- | -------------------------------- |
| `GET`  | `/health-records` | List health records              |
| `GET`  | `/medications`    | List medications                 |
| `POST` | `/medications`    | Record medication administration |

### Death Reports

| Method | Endpoint         | Description            |
| ------ | ---------------- | ---------------------- |
| `GET`  | `/death-reports` | List death reports     |
| `POST` | `/death-reports` | Report an animal death |

### Protocols

| Method | Endpoint                  | Description                |
| ------ | ------------------------- | -------------------------- |
| `GET`  | `/protocols`              | List IACUC protocols       |
| `GET`  | `/protocols/:id`          | Get protocol by ID         |
| `POST` | `/protocols`              | Create a protocol          |
| `POST` | `/protocols/:id/validate` | Run IACUC compliance check |

### Enrichments & Training

| Method | Endpoint       | Description             |
| ------ | -------------- | ----------------------- |
| `GET`  | `/enrichments` | List enrichment records |
| `GET`  | `/trainings`   | List training records   |

### Work Sessions

| Method | Endpoint          | Description         |
| ------ | ----------------- | ------------------- |
| `GET`  | `/work-sessions`  | List work sessions  |
| `GET`  | `/batch-sessions` | List batch sessions |

### Audit & Signatures

| Method | Endpoint                 | Description                 |
| ------ | ------------------------ | --------------------------- |
| `GET`  | `/audit-log`             | Query audit trail           |
| `POST` | `/electronic-signatures` | Create electronic signature |

### Auth

| Method | Endpoint         | Description                    |
| ------ | ---------------- | ------------------------------ |
| `POST` | `/auth/register` | Register a new user            |
| `POST` | `/auth/login`    | Authenticate and receive token |
| `POST` | `/auth/logout`   | Logout (client discards token) |

### Labs

| Method | Endpoint            | Description       |
| ------ | ------------------- | ----------------- |
| `GET`  | `/labs`             | List user's labs  |
| `POST` | `/labs`             | Create a new lab  |
| `POST` | `/labs/:id/members` | Add member to lab |

### Billing & Usage

| Method | Endpoint                                       | Description                       |
| ------ | ---------------------------------------------- | --------------------------------- |
| `GET`  | `/billing/usage`                               | Get plan limits and current usage |
| `GET`  | `/billing?labId=...&startDate=...&endDate=...` | Generate billing report           |
| `GET`  | `/rates`                                       | List per-diem rates               |

### Subscriptions

| Method | Endpoint                  | Description                |
| ------ | ------------------------- | -------------------------- |
| `GET`  | `/subscriptions/status`   | Get subscription status    |
| `POST` | `/subscriptions/create`   | Create PayPal subscription |
| `POST` | `/subscriptions/activate` | Activate subscription      |
| `POST` | `/subscriptions/cancel`   | Cancel subscription        |

### Stripe

| Method | Endpoint          | Description                          |
| ------ | ----------------- | ------------------------------------ |
| `GET`  | `/stripe/config`  | Get Stripe publishable key and plans |
| `POST` | `/stripe/create`  | Create Stripe Checkout Session       |
| `POST` | `/stripe/webhook` | Stripe webhook callback              |

### License & Signatures

| Method | Endpoint          | Description                       |
| ------ | ----------------- | --------------------------------- |
| `GET`  | `/license/status` | Get license configuration         |
| `POST` | `/license/sign`   | Sign a report (RSA or unverified) |
| `POST` | `/license/verify` | Verify a report signature         |

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
