# Dedicated Database & Resource Connector Management System

## 1. Architectural Overview

The EHS Safety AI platform features a dedicated, enterprise-grade **Database & Resource Connector Management Module**.

### Core Isolation Principle
- **Primary Neon PostgreSQL (`neondb`)**: Remains 100% unchanged. Contains existing operational business tables (`fact_ehs_event`, `fact_workforce_attendance`, `fact_maintenance_work_order`, `video_safety_analyses`, `safety_alerts`, `users`).
- **Dedicated Connector Database (`ehs_connector_db`)**: Completely separate PostgreSQL database running on its own connection pool, lifecycle management, error handling, and declarative base (`ConnectorBase`).
- **Dynamic Adapter Pattern**: External databases (PostgreSQL, MySQL, MongoDB, SQLite, SQL Server, Oracle) connect dynamically in-memory through native Python client adapters. External records are **never stored** in `ehs_connector_db` or `neondb`.

```
               ┌────────────────────────────────────────────────────────┐
               │              EHS Safety AI Backend                     │
               │  FastAPI (Port 8000) / React + Vite (Port 5173)        │
               └───────────┬────────────────────────────────┬───────────┘
                           │                                │
            (Primary Operations)               (Connector Management)
                           │                                │
                           ▼                                ▼
       ┌───────────────────────────────┐   ┌────────────────────────────────┐
       │ Primary Neon DB: neondb       │   │ Connector DB: ehs_connector_db │
       │ Schema: ehs_core              │   │ Database: ehs_connector_db     │
       │ - fact_ehs_event              │   │ - data_connectors              │
       │ - fact_workforce_attendance   │   │ - connector_test_history       │
       │ - fact_maintenance_work_order│   │ - connector_metadata_cache     │
       │ - safety_alerts               │   │ - connector_module_mappings    │
       │ - video_safety_analyses       │   │ - connector_agent_mappings     │
       │ - users                       │   │ - connector_audit_logs         │
       └───────────────────────────────┘   └────────────────────────────────┘
                                                            │
                           ┌────────────────────────────────┼────────────────────────────────┐
                           │ (Dynamic On-Demand Handshakes) │ (Strict Read-Only Previews)    │
                           ▼                                ▼                                ▼
               ┌───────────────────────┐        ┌───────────────────────┐        ┌───────────────────────┐
               │ External PostgreSQL   │        │ External MySQL        │        │ External MongoDB      │
               │ Adapter: psycopg2     │        │ Adapter: pymysql      │        │ Adapter: pymongo      │
               └───────────────────────┘        └───────────────────────┘        └───────────────────────┘
```

---

## 2. Supported Database Engines & Native Drivers

All required database drivers are installed in the backend virtual environment:

| Engine | Type | Driver | Python Library | Protocol | Default Port |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PostgreSQL** | SQL Engine | `psycopg2` | `psycopg2-binary 2.9.13` | Wire Protocol 3.0 | `5432` |
| **MySQL / MariaDB** | SQL Engine | `pymysql` | `PyMySQL 1.2.4` | MySQL Native | `3306` |
| **MongoDB & Atlas** | NoSQL Document | `pymongo` | `pymongo 4.20.0` + `dnspython` | BSON / Mongo Wire | `27017` |
| **SQLite** | Embedded SQL | `sqlite3` | Python Standard Library | In-Process C Engine | N/A |
| **Microsoft SQL Server** | SQL Engine | `pymssql` | `pymssql 2.4.6` | TDS Protocol | `1433` |
| **Oracle Database** | SQL Engine | `oracledb` | `python-oracledb 26.1.0` | Thin Client Mode | `1521` |

---

## 3. Dedicated Database Schema (`ehs_connector_db`)

The separate database maintains six dedicated tables:

### 1. `data_connectors`
Stores connector configurations, destination addresses, encrypted credentials, connection limits, and status flags.
- `connector_id` (VARCHAR(64), Primary Key): Formatted as `CONN-[ENGINE]-[HEX]`, e.g., `CONN-PG-D4F1E0A2`.
- `name` (VARCHAR(120)): User-defined connector title.
- `description` (TEXT): Optional operational description.
- `db_type` (VARCHAR(32)): `postgresql`, `mysql`, `mongodb`, `sqlite`, `sqlserver`, `oracle`.
- `host` (VARCHAR(255)), `port` (INTEGER), `database_name` (VARCHAR(120)), `username` (VARCHAR(120)).
- `encrypted_password` (TEXT): AES-256-GCM ciphertext.
- `encrypted_uri` (TEXT): AES-256-GCM encrypted connection string.
- `ssl_mode` (VARCHAR(32)): `disable`, `allow`, `prefer`, `require`.
- `read_only` (BOOLEAN): Defaults to `TRUE`.
- `connection_timeout_sec` (INTEGER): Default 10s.
- `pool_size` (INTEGER): Default 5.
- `schema_filters_json`, `collection_filters_json` (TEXT): JSON array of allowed schemas/collections.
- `plant_id` (VARCHAR(64)): Plant scope restriction (`ALL`, `PLANT-A`, `PLANT-B`, `PLANT-C`).
- `status` (VARCHAR(32)): `CONNECTED`, `DISCONNECTED`, `FAILED`, `TESTING`.
- `last_tested_at`, `last_connected_at`, `last_failed_at`, `last_latency_ms`.
- `metadata_json`, `metadata_refreshed_at`: Discovered catalog snapshot.

### 2. `connector_test_history`
Maintains an immutable historical record of connection handshakes and diagnostic metrics.
- `test_id` (VARCHAR(64), Primary Key)
- `connector_id` (VARCHAR(64), Foreign Key → `data_connectors.connector_id`)
- `db_type` (VARCHAR(32))
- `tested_at` (TIMESTAMP)
- `success` (BOOLEAN)
- `latency_ms` (FLOAT)
- `status` (VARCHAR(32))
- `server_version` (VARCHAR(120))
- `error_code`, `error_message` (TEXT)
- `discovered_databases_json`, `discovered_schemas_json`, `discovered_collections_json` (TEXT)
- `tested_by` (VARCHAR(120))

### 3. `connector_metadata_cache`
Caches discovered catalog trees so navigation and schema inspection don't cause constant round-trips.
- `cache_id` (VARCHAR(64), Primary Key)
- `connector_id` (VARCHAR(64), Foreign Key → `data_connectors.connector_id`)
- `db_type` (VARCHAR(32))
- `databases_json`, `schemas_json`, `tables_json`, `collections_json` (TEXT)
- `refreshed_at` (TIMESTAMP)

### 4. `connector_module_mappings`
Governs which EHS Application modules are authorized to query external tables.
- `mapping_id` (VARCHAR(64), Primary Key)
- `connector_id` (VARCHAR(64), Foreign Key → `data_connectors.connector_id`)
- `ehs_module` (VARCHAR(64)): `overview`, `monitoring`, `events`, `insights`, `compliance`.
- `allowed_tables_json` (TEXT): e.g. `["equipment_telemetry", "maintenance_logs"]`.
- `access_level` (VARCHAR(32)): `READ_ONLY`.
- `enabled` (BOOLEAN)

### 5. `connector_agent_mappings`
Governs authorization for the 8 EHS AI Agents.
- `mapping_id` (VARCHAR(64), Primary Key)
- `connector_id` (VARCHAR(64), Foreign Key → `data_connectors.connector_id`)
- `agent_name` (VARCHAR(64)): e.g. `telemetry_anomaly_agent`, `hazard_agent`.
- `allowed_tables_json`, `allowed_collections_json` (TEXT)
- `plant_scope` (VARCHAR(64))
- `max_query_limit` (INTEGER): Default 25.
- `enabled` (BOOLEAN)

### 6. `connector_audit_logs`
Immutable security and query log.
- `log_id` (VARCHAR(64), Primary Key)
- `connector_id` (VARCHAR(64))
- `action` (VARCHAR(64)): `CREATE`, `UPDATE`, `DELETE`, `TESTED`, `DISCONNECTED`, `METADATA_REFRESHED`, `DATA_PREVIEWED`, `AGENT_QUERY`.
- `result` (VARCHAR(32)): `SUCCESS`, `FAILED`, `BLOCKED`.
- `user_id`, `user_email`, `ip_address`
- `execution_time_ms` (FLOAT)
- `details_json` (TEXT)
- `created_at` (TIMESTAMP)

---

## 4. Security & Governance

### Authenticated AES-256-GCM Encryption
- Passwords, URIs, and credentials are encrypted using **AES-256-GCM** with a 96-bit randomized nonce.
- Encryption key is derived deterministically from `effective_connector_encryption_key` using **PBKDF2-HMAC-SHA256** (100,000 iterations).
- Passwords are **never returned to the frontend or AI agents**. All API endpoints return masked strings (`••••••••`).

### SSRF Protection
The backend blocks server-side request forgery (SSRF) during transient testing and creation:
- Hardcoded blocks against cloud instance metadata endpoints:
  - `169.254.169.254` (AWS, Azure, GCP metadata)
  - `169.254.170.2` (AWS ECS metadata)
  - `metadata.google.internal`
  - `metadata.azure.com`
- DNS resolution checks block target addresses resolving to link-local (`169.254.0.0/16` or `fe80::/10`).

### Read-Only Query Defense
- Preview and agent queries enforce strict read-only execution.
- Disallowed SQL keywords (`DROP`, `ALTER`, `TRUNCATE`, `DELETE`, `INSERT`, `UPDATE`, `GRANT`, `REVOKE`, `CREATE`, `MERGE`, `EXEC`, `EXECUTE`) are rejected with `HTTP 400`.
- SQL identifiers (table, schema, and column names) are strictly sanitized against injection characters.

---

## 5. EHS AI Agent Data Access Layer

The controlled data access layer (`AgentConnectedDataService` in `backend/app/connectors/agent_access.py`) allows specialized EHS AI agents to query external databases safely:

```python
from app.connectors.agent_access import AgentConnectedDataService

agent_service = AgentConnectedDataService(db=connector_db_session, plant_scope="PLANT-A")

# 1. Inspect available external data sources
sources = agent_service.get_available_sources(plant_id="PLANT-A")

# 2. Query external records with automated provenance attribution
result = agent_service.query_external_records(
    connector_id="CONN-PG-A1B2C3D4",
    table_or_collection="equipment_sensors",
    agent_name="telemetry_anomaly_agent",
    filter_clause="temperature > 75.0",
    limit=20,
)
```

### Provenance Attribution
Every record retrieved by an AI agent is tagged with immutable provenance:
```json
{
  "provenance": {
    "source_type": "postgresql",
    "connector_id": "CONN-PG-A1B2C3D4",
    "connector_name": "Plant-A Industrial Telemetry SQL",
    "database": "telemetry_db",
    "table": "equipment_sensors",
    "requested_by_agent": "telemetry_anomaly_agent",
    "retrieved_at": "2026-11-13T10:30:00.000Z",
    "records_count": 12,
    "note": "Retrieved by AI Agent 'telemetry_anomaly_agent' from external connected postgresql database 'Plant-A Industrial Telemetry SQL'."
  },
  "records": [...]
}
```

---

## 6. Environment Configuration

In `backend/.env`:

```env
# Primary EHS Database (Neon PostgreSQL) - NEVER CHANGED
DATABASE_URL=postgresql://neondb_owner:npg_qMFpoIE89AhL@ep-autumn-fire-bey5vazs-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require

# Dedicated Separate PostgreSQL Database for Resource & Database Connector Management
CONNECTOR_DATABASE_URL=postgresql://neondb_owner:npg_qMFpoIE89AhL@ep-autumn-fire-bey5vazs-pooler.c-9.us-east-2.aws.neon.tech/ehs_connector_db?sslmode=require&channel_binding=require
CONNECTOR_ENCRYPTION_KEY=ehs-enterprise-resource-connector-master-aes-2026
```

---

## 7. REST API Endpoints

All endpoints are mounted under `/api/v1/connectors`:

| Method | Endpoint | Description | Auth Scope |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Check health, dialect, and connection pool status of `ehs_connector_db` | Authenticated |
| `GET` | `/drivers/status` | List installed Python database drivers and supported engines | Authenticated |
| `GET` | `/overview` | Aggregated connector KPI stats (Total, Active, Failed, Latency) | Authenticated |
| `GET` | `/` | List all registered database connectors with masked secrets | Authenticated |
| `POST` | `/` | Register and save a new connector (AES-256 encrypted) | Admin Only |
| `GET` | `/{connector_id}` | Retrieve details for a single connector | Authenticated |
| `PUT` | `/{connector_id}` | Update connector configuration or rotate credentials | Admin Only |
| `DELETE` | `/{connector_id}` | Delete connector and cascade release resources | Admin Only |
| `POST` | `/test` | Test transient connection parameters dynamically before saving | Authenticated |
| `POST` | `/{connector_id}/test` | Test saved connector, record in test history, update status | Authenticated |
| `GET` | `/{connector_id}/history` | Retrieve historical connection tests & diagnostics | Authenticated |
| `POST` | `/{connector_id}/disconnect` | Disconnect an active connector | Admin Only |
| `GET` | `/{connector_id}/metadata` | Retrieve or refresh discovered catalog tree | Authenticated |
| `GET` | `/{connector_id}/databases` | List visible database catalogs | Authenticated |
| `GET` | `/{connector_id}/schemas` | List visible schemas | Authenticated |
| `GET` | `/{connector_id}/tables` | List tables and views | Authenticated |
| `GET` | `/{connector_id}/collections`| List MongoDB collections | Authenticated |
| `POST` | `/{connector_id}/preview` | Safe paginated read-only data preview with filter clause | Authenticated |
| `GET` | `/{connector_id}/modules` | List authorized EHS application module mappings | Authenticated |
| `POST` | `/{connector_id}/modules` | Upsert module authorization mapping | Admin Only |
| `GET` | `/{connector_id}/agents` | List authorized AI Agent mappings | Authenticated |
| `POST` | `/{connector_id}/agents` | Upsert AI Agent authorization mapping | Admin Only |
| `GET` | `/{connector_id}/audit-logs` | Retrieve audit trail for a specific connector | Authenticated |
| `GET` | `/audit-logs/recent` | Retrieve recent audit events across all connectors | Authenticated |

---

## 8. Verification & Test Commands

To run the complete test suite against the connector module:

```powershell
$env:PYTHONPATH="backend"
& "backend\.venv\Scripts\python.exe" -m pytest backend/tests/test_connectors.py -v
```

To run existing regression tests:
```powershell
$env:PYTHONPATH="backend"
& "backend\.venv\Scripts\python.exe" -m pytest backend/tests/test_auth_and_health.py backend/tests/test_video_api.py -v
```

To run frontend TypeScript and Vite production build checks:
```powershell
npx tsc --noEmit
npm run build
```

