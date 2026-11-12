from sqlalchemy import Column, String, DateTime, Date, Integer, Numeric, Boolean, Index
from app.core.database import Base

class WorkforceAttendance(Base):
    """
    Workforce attendance and shift context table.
    Mapped 1:1 to fact_workforce_attendance.csv (16,560 rows).
    """
    __tablename__ = "fact_workforce_attendance"
    __table_args__ = (
        Index("ix_workforce_date_plant_shift", "work_date", "plant_id", "shift_id"),
        Index("ix_workforce_employee", "employee_id"),
        Index("ix_workforce_training_status", "training_compliance"),
        {"schema": "ehs_core"}
    )

    attendance_id = Column(String(50), primary_key=True, index=True)
    work_date = Column(Date, nullable=False)
    employee_id = Column(String(50), nullable=False)
    plant_id = Column(String(50), nullable=False)
    shift_id = Column(String(10), nullable=False)
    scheduled_hours = Column(Integer, nullable=False)
    actual_hours = Column(Numeric(4, 1), nullable=False)
    attendance_status = Column(String(50), nullable=False)
    overtime_hours = Column(Numeric(4, 1), nullable=False)
    skill_match = Column(String(50), nullable=False)
    training_compliance = Column(String(50), nullable=False)

class MaintenanceWorkOrder(Base):
    """
    Maintenance work order table.
    Mapped 1:1 to fact_maintenance_work_order.csv (400 rows).
    """
    __tablename__ = "fact_maintenance_work_order"
    __table_args__ = (
        Index("ix_maint_plant_machine", "plant_id", "machine_id"),
        Index("ix_maint_priority_status", "priority", "status"),
        Index("ix_maint_technician", "technician_id"),
        {"schema": "ehs_core"}
    )

    work_order_id = Column(String(50), primary_key=True, index=True)
    machine_id = Column(String(50), nullable=False)
    plant_id = Column(String(50), nullable=False)
    created_ts = Column(DateTime, nullable=False)
    maintenance_type = Column(String(50), nullable=False)
    failure_mode = Column(String(100), nullable=False)
    priority = Column(String(20), nullable=False)
    planned_start = Column(DateTime, nullable=False)
    actual_start = Column(DateTime, nullable=True)  # Nullable as validated
    downtime_avoided_estimate_min = Column(Integer, nullable=False)
    status = Column(String(50), nullable=False)
    technician_id = Column(String(50), nullable=False)

