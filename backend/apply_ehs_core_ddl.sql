-- ============================================================================
-- EHS SAFETY AI PLATFORM — ISOLATED SCHEMA DDL MIGRATION
-- Database: Neon PostgreSQL 18.6
-- Schema: ehs_core
-- ============================================================================

-- 1. Create Dedicated Isolated Schema Namespace
CREATE SCHEMA IF NOT EXISTS ehs_core;

-- 2. Master EHS Events Table (Mapped to fact_ehs_event.csv)
CREATE TABLE IF NOT EXISTS ehs_core.fact_ehs_event (
    ehs_event_id VARCHAR(50) PRIMARY KEY,
    event_ts TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    plant_id VARCHAR(50) NOT NULL,
    area VARCHAR(100) NOT NULL,
    shift_id VARCHAR(10) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    hazard_category VARCHAR(100) NOT NULL,
    risk_severity VARCHAR(50) NOT NULL,
    lost_time_injury BOOLEAN NOT NULL,
    action_owner VARCHAR(50) NOT NULL,
    due_date DATE NOT NULL,
    action_status VARCHAR(50) NOT NULL,
    permit_id VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_ehs_event_plant_shift ON ehs_core.fact_ehs_event (plant_id, shift_id);
CREATE INDEX IF NOT EXISTS ix_ehs_event_type_severity ON ehs_core.fact_ehs_event (event_type, risk_severity);
CREATE INDEX IF NOT EXISTS ix_ehs_event_ts ON ehs_core.fact_ehs_event (event_ts);
CREATE INDEX IF NOT EXISTS ix_ehs_event_owner ON ehs_core.fact_ehs_event (action_owner);

-- 3. Workforce Attendance Table (Mapped to fact_workforce_attendance.csv)
CREATE TABLE IF NOT EXISTS ehs_core.fact_workforce_attendance (
    attendance_id VARCHAR(50) PRIMARY KEY,
    work_date DATE NOT NULL,
    employee_id VARCHAR(50) NOT NULL,
    plant_id VARCHAR(50) NOT NULL,
    shift_id VARCHAR(10) NOT NULL,
    scheduled_hours INTEGER NOT NULL,
    actual_hours NUMERIC(4,1) NOT NULL,
    attendance_status VARCHAR(50) NOT NULL,
    overtime_hours NUMERIC(4,1) NOT NULL,
    skill_match VARCHAR(50) NOT NULL,
    training_compliance VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_workforce_date_plant_shift ON ehs_core.fact_workforce_attendance (work_date, plant_id, shift_id);
CREATE INDEX IF NOT EXISTS ix_workforce_employee ON ehs_core.fact_workforce_attendance (employee_id);
CREATE INDEX IF NOT EXISTS ix_workforce_training_status ON ehs_core.fact_workforce_attendance (training_compliance);

-- 4. Maintenance Work Orders Table (Mapped to fact_maintenance_work_order.csv)
CREATE TABLE IF NOT EXISTS ehs_core.fact_maintenance_work_order (
    work_order_id VARCHAR(50) PRIMARY KEY,
    machine_id VARCHAR(50) NOT NULL,
    plant_id VARCHAR(50) NOT NULL,
    created_ts TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    maintenance_type VARCHAR(50) NOT NULL,
    failure_mode VARCHAR(100) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    planned_start TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITHOUT TIME ZONE NULL,
    downtime_avoided_estimate_min INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    technician_id VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_maint_plant_machine ON ehs_core.fact_maintenance_work_order (plant_id, machine_id);
CREATE INDEX IF NOT EXISTS ix_maint_priority_status ON ehs_core.fact_maintenance_work_order (priority, status);
CREATE INDEX IF NOT EXISTS ix_maint_technician ON ehs_core.fact_maintenance_work_order (technician_id);

-- 5. Ingestion Audit Trail Table
CREATE TABLE IF NOT EXISTS ehs_core.ehs_ingestion_audit (
    audit_id SERIAL PRIMARY KEY,
    dataset_name VARCHAR(100) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    records_processed INTEGER NOT NULL,
    records_inserted INTEGER NOT NULL,
    records_skipped INTEGER NOT NULL,
    ingestion_ts TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL
);

