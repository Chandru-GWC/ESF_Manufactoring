import csv
from datetime import datetime
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.ehs_event import EhsEvent
from app.schemas.ehs_event import IngestionResult

class EhsIngestionService:
    @staticmethod
    def parse_and_validate_csv(file_path: str) -> Tuple[List[EhsEvent], List[str]]:
        events = []
        errors = []
        seen_ids = set()

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                expected_cols = {
                    "ehs_event_id", "event_ts", "plant_id", "area", "shift_id",
                    "event_type", "hazard_category", "risk_severity",
                    "lost_time_injury", "action_owner", "due_date",
                    "action_status", "permit_id"
                }

                if not expected_cols.issubset(set(reader.fieldnames or [])):
                    missing = expected_cols - set(reader.fieldnames or [])
                    errors.append(f"Missing mandatory CSV columns: {missing}")
                    return [], errors

                for line_num, row in enumerate(reader, start=2):
                    eid = row["ehs_event_id"].strip()
                    if not eid:
                        errors.append(f"Line {line_num}: Empty ehs_event_id")
                        continue

                    if eid in seen_ids:
                        errors.append(f"Line {line_num}: Duplicate ehs_event_id {eid} in file")
                        continue
                    seen_ids.add(eid)

                    try:
                        event_dt = datetime.fromisoformat(row["event_ts"].strip())
                        due_d = datetime.strptime(row["due_date"].strip(), "%Y-%m-%d").date()
                        lti = row["lost_time_injury"].strip().lower() in ("true", "1", "yes")

                        event = EhsEvent(
                            ehs_event_id=eid,
                            event_ts=event_dt,
                            plant_id=row["plant_id"].strip(),
                            area=row["area"].strip(),
                            shift_id=row["shift_id"].strip(),
                            event_type=row["event_type"].strip(),
                            hazard_category=row["hazard_category"].strip(),
                            risk_severity=row["risk_severity"].strip(),
                            lost_time_injury=lti,
                            action_owner=row["action_owner"].strip(),
                            due_date=due_d,
                            action_status=row["action_status"].strip(),
                            permit_id=row["permit_id"].strip()
                        )
                        events.append(event)
                    except Exception as e:
                        errors.append(f"Line {line_num}: Data conversion error ({e})")
        except Exception as ex:
            errors.append(f"Failed to open/read file: {ex}")

        return events, errors

    @staticmethod
    def ingest_events(db: Session, file_path: str) -> IngestionResult:
        events, errors = EhsIngestionService.parse_and_validate_csv(file_path)
        if errors and not events:
            return IngestionResult(
                status="FAILED",
                total_records=0,
                inserted=0,
                skipped_duplicates=0,
                errors=errors
            )

        existing_ids = set(
            row[0] for row in db.query(EhsEvent.ehs_event_id).all()
        )

        new_events = [e for e in events if e.ehs_event_id not in existing_ids]
        skipped_duplicates = len(events) - len(new_events)

        if new_events:
            db.bulk_save_objects(new_events)
            db.commit()

        return IngestionResult(
            status="SUCCESS",
            total_records=len(events),
            inserted=len(new_events),
            skipped_duplicates=skipped_duplicates,
            errors=errors
        )

