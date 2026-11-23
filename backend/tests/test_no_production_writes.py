"""Proves the suite cannot write to, or start the scheduler against, the live database."""
import pytest
from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO ehs_core.safety_alerts (alert_id) VALUES ('x')",
        "UPDATE ehs_core.safety_alerts SET status='RESOLVED'",
        "DELETE FROM ehs_core.safety_alerts",
        "DROP TABLE ehs_core.safety_alerts",
        "CREATE TABLE ehs_core.zzz (a int)",
        "ALTER TABLE ehs_core.safety_alerts ADD COLUMN x int",
    ],
)
def test_live_engine_refuses_write_statements(sql):
    with pytest.raises(Exception) as exc:
        with engine.connect() as conn:
            conn.execute(text(sql))
    assert "must not write to the live database" in str(exc.value)


def test_live_engine_still_allows_reads():
    with engine.connect() as conn:
        assert conn.execute(text("select 1")).scalar() == 1


def test_real_scheduler_is_disabled_for_every_test():
    assert settings.EHS_ALERT_SCHEDULER is False
