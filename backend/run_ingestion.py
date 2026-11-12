import os
import csv
from datetime import datetime, date
from decimal import Decimal
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")

files_config = [
    {
        "name": "fact_ehs_event",
        "file_path": "src/data/fact_ehs_event.csv",
        "table": "ehs_core.fact_ehs_event",
        "pk": "ehs_event_id",
        "expected_rows": 400,
        "cols": [
            "ehs_event_id", "event_ts", "plant_id", "area", "shift_id",
            "event_type", "hazard_category", "risk_severity", "lost_time_injury",
            "action_owner", "due_date", "action_status", "permit_id"
        ]
    },
    {
        "name": "fact_workforce_attendance",
        "file_path": "src/data/fact_workforce_attendance.csv",
        "table": "ehs_core.fact_workforce_attendance",
        "pk": "attendance_id",
        "expected_rows": 16560,
        "cols": [
            "attendance_id", "work_date", "employee_id", "plant_id", "shift_id",
            "scheduled_hours", "actual_hours", "attendance_status", "overtime_hours",
            "skill_match", "training_compliance"
        ]
    },
    {
        "name": "fact_maintenance_work_order",
        "file_path": "src/data/fact_maintenance_work_order.csv",
        "table": "ehs_core.fact_maintenance_work_order",
        "pk": "work_order_id",
        "expected_rows": 400,
        "cols": [
            "work_order_id", "machine_id", "plant_id", "created_ts", "maintenance_type",
            "failure_mode", "priority", "planned_start", "actual_start",
            "downtime_avoided_estimate_min", "status", "technician_id"
        ]
    }
]

def parse_record(dataset_name, r):
    if dataset_name == "fact_ehs_event":
        return (
            r["ehs_event_id"].strip(),
            datetime.fromisoformat(r["event_ts"].strip()),
            r["plant_id"].strip(),
            r["area"].strip(),
            r["shift_id"].strip(),
            r["event_type"].strip(),
            r["hazard_category"].strip(),
            r["risk_severity"].strip(),
            r["lost_time_injury"].strip().lower() in ("true", "1", "yes"),
            r["action_owner"].strip(),
            datetime.strptime(r["due_date"].strip(), "%Y-%m-%d").date(),
            r["action_status"].strip(),
            r["permit_id"].strip()
        )
    elif dataset_name == "fact_workforce_attendance":
        return (
            r["attendance_id"].strip(),
            datetime.strptime(r["work_date"].strip(), "%Y-%m-%d").date(),
            r["employee_id"].strip(),
            r["plant_id"].strip(),
            r["shift_id"].strip(),
            int(r["scheduled_hours"].strip()),
            Decimal(r["actual_hours"].strip()),
            r["attendance_status"].strip(),
            Decimal(r["overtime_hours"].strip()),
            r["skill_match"].strip(),
            r["training_compliance"].strip()
        )
    elif dataset_name == "fact_maintenance_work_order":
        act_start = r["actual_start"].strip()
        act_start_dt = datetime.fromisoformat(act_start) if act_start else None
        return (
            r["work_order_id"].strip(),
            r["machine_id"].strip(),
            r["plant_id"].strip(),
            datetime.fromisoformat(r["created_ts"].strip()),
            r["maintenance_type"].strip(),
            r["failure_mode"].strip(),
            r["priority"].strip(),
            datetime.fromisoformat(r["planned_start"].strip()),
            act_start_dt,
            int(r["downtime_avoided_estimate_min"].strip()),
            r["status"].strip(),
            r["technician_id"].strip()
        )

def ingest_dataset(conn, cfg):
    dataset_name = cfg["name"]
    file_path = cfg["file_path"]
    table_name = cfg["table"]
    pk_col = cfg["pk"]
    cols = cfg["cols"]

    print(f"\n==========================================")
    print(f"Starting ingestion for: {dataset_name} ({file_path})")

    # 1. Parse and validate file
    parsed_records = []
    seen_in_file = set()
    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for line_num, r in enumerate(reader, start=2):
            pk_val = r[pk_col].strip()
            if pk_val in seen_in_file:
                raise ValueError(f"Duplicate PK in file {file_path} at line {line_num}: {pk_val}")
            seen_in_file.add(pk_val)
            parsed_tuple = parse_record(dataset_name, r)
            parsed_records.append(parsed_tuple)

    total_in_file = len(parsed_records)
    print(f"Parsed {total_in_file} records from {file_path}. Validating against Neon...")

    # 2. Check existing PKs in database
    cur = conn.cursor()
    cur.execute(f"SELECT {pk_col} FROM {table_name};")
    existing_pks = set(row[0] for row in cur.fetchall())
    print(f"Existing records in {table_name}: {len(existing_pks)}")

    records_to_insert = [r for r in parsed_records if r[0] not in existing_pks]
    skipped_count = total_in_file - len(records_to_insert)

    if not records_to_insert:
        print(f"All {total_in_file} records already exist in {table_name}. Zero new inserts needed.")
        # Record audit log
        audit_sql = """
            INSERT INTO ehs_core.ehs_ingestion_audit 
            (dataset_name, file_path, records_processed, records_inserted, records_skipped, status)
            VALUES (%s, %s, %s, %s, %s, %s);
        """
        cur.execute(audit_sql, (dataset_name, file_path, total_in_file, 0, skipped_count, "SUCCESS_EXISTING"))
        conn.commit()
        cur.close()
        return total_in_file, 0, skipped_count

    # 3. Parameterized bulk insert
    cols_str = ", ".join(cols)
    insert_sql = f"""
        INSERT INTO {table_name} ({cols_str})
        VALUES %s
        ON CONFLICT ({pk_col}) DO NOTHING;
    """

    execute_values(cur, insert_sql, records_to_insert, page_size=1000)
    inserted_count = len(records_to_insert)

    # 4. Record audit trail
    audit_sql = """
        INSERT INTO ehs_core.ehs_ingestion_audit 
        (dataset_name, file_path, records_processed, records_inserted, records_skipped, status)
        VALUES (%s, %s, %s, %s, %s, %s);
    """
    cur.execute(audit_sql, (dataset_name, file_path, total_in_file, inserted_count, skipped_count, "SUCCESS"))

    conn.commit()
    cur.close()
    print(f"Successfully committed: {inserted_count} inserted, {skipped_count} skipped.")
    return total_in_file, inserted_count, skipped_count

def main():
    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        results = {}
        for cfg in files_config:
            total, inserted, skipped = ingest_dataset(conn, cfg)
            results[cfg["name"]] = {
                "total": total,
                "inserted": inserted,
                "skipped": skipped
            }

        print("\nAll datasets ingested successfully without error.")
        print(results)
    except Exception as e:
        conn.rollback()
        print(f"INGESTION_ERROR: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()

