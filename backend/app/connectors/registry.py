"""
Connector Registry.
Registers database adapters, inspects installed driver libraries, and exposes engine capabilities.
"""
from __future__ import annotations

import importlib.util
from typing import Dict, List, Optional, Type

from app.connectors.adapters.mongodb import MongoDBConnector
from app.connectors.adapters.mysql import MySQLConnector
from app.connectors.adapters.oracle import OracleConnector
from app.connectors.adapters.postgres import PostgreSQLConnector
from app.connectors.adapters.sqlite import SQLiteConnector
from app.connectors.adapters.sqlserver import SQLServerConnector
from app.connectors.base import BaseConnector
from app.schemas.connector import DatabaseType, DriverStatusItem, DriverStatusResponse

# Registry mapping from db_type to adapter class
CONNECTOR_ADAPTERS: Dict[DatabaseType, Type[BaseConnector]] = {
    "sqlite": SQLiteConnector,
    "postgresql": PostgreSQLConnector,
    "mysql": MySQLConnector,
    "mongodb": MongoDBConnector,
    "sqlserver": SQLServerConnector,
    "oracle": OracleConnector,
}


def _check_module(module_name: str) -> tuple[bool, Optional[str]]:
    try:
        mod = importlib.import_module(module_name)
        ver = getattr(mod, "__version__", None) or getattr(mod, "version", None)
        return True, str(ver) if ver else "installed"
    except ImportError:
        return False, None
    except Exception:
        return False, None


def get_driver_status_list() -> List[DriverStatusItem]:
    """Inspect installed driver libraries across all supported database types."""
    # 1. PostgreSQL (psycopg2)
    pg_ok, pg_ver = _check_module("psycopg2")
    # 2. SQLite (sqlite3)
    sqlite_ok, sqlite_ver = _check_module("sqlite3")
    # 3. MySQL (pymysql)
    my_ok, my_ver = _check_module("pymysql")
    # 4. MongoDB (pymongo)
    mongo_ok, mongo_ver = _check_module("pymongo")
    # 5. SQL Server (pymssql)
    mssql_ok, mssql_ver = _check_module("pymssql")
    # 6. Oracle (oracledb)
    ora_ok, ora_ver = _check_module("oracledb")

    items = [
        DriverStatusItem(
            db_type="postgresql",
            display_name="PostgreSQL",
            category="SQL",
            driver_name="psycopg2-binary",
            installed=pg_ok,
            version=pg_ver,
            default_port=5432,
            supports_schemas=True,
            supports_collections=False,
            supports_ssl=True,
            description="Enterprise relational database engine with schemas, indexes, and full ACID guarantees.",
        ),
        DriverStatusItem(
            db_type="sqlite",
            display_name="SQLite (Embedded)",
            category="Embedded",
            driver_name="sqlite3 (Standard Library)",
            installed=sqlite_ok,
            version=sqlite_ver,
            default_port=None,
            supports_schemas=False,
            supports_collections=False,
            supports_ssl=False,
            description="Lightweight self-contained zero-config SQL engine, ideal for local testing & edge logs.",
        ),
        DriverStatusItem(
            db_type="mysql",
            display_name="MySQL",
            category="SQL",
            driver_name="pymysql",
            installed=my_ok,
            version=my_ver,
            default_port=3306,
            supports_schemas=True,
            supports_collections=False,
            supports_ssl=True,
            description="High-performance open-source relational database widely used for operational systems.",
        ),
        DriverStatusItem(
            db_type="mongodb",
            display_name="MongoDB / MongoDB Atlas",
            category="NoSQL",
            driver_name="pymongo",
            installed=mongo_ok,
            version=mongo_ver,
            default_port=27017,
            supports_schemas=False,
            supports_collections=True,
            supports_ssl=True,
            description="Document-based NoSQL engine supporting dynamic JSON-like documents and Atlas clusters.",
        ),
        DriverStatusItem(
            db_type="sqlserver",
            display_name="Microsoft SQL Server",
            category="SQL",
            driver_name="pymssql",
            installed=mssql_ok,
            version=mssql_ver,
            default_port=1433,
            supports_schemas=True,
            supports_collections=False,
            supports_ssl=True,
            description="Microsoft enterprise relational database management system for manufacturing & ERP.",
        ),
        DriverStatusItem(
            db_type="oracle",
            display_name="Oracle Database",
            category="SQL",
            driver_name="oracledb",
            installed=ora_ok,
            version=ora_ver,
            default_port=1521,
            supports_schemas=True,
            supports_collections=False,
            supports_ssl=True,
            description="Oracle multi-model database management system in pure-Python thin mode.",
        ),
    ]
    return items


def get_driver_status_response() -> DriverStatusResponse:
    drivers = get_driver_status_list()
    installed = sum(1 for d in drivers if d.installed)
    return DriverStatusResponse(
        drivers=drivers,
        total_drivers=len(drivers),
        installed_count=installed,
    )


def get_adapter_class(db_type: DatabaseType) -> Type[BaseConnector]:
    if db_type not in CONNECTOR_ADAPTERS:
        raise ValueError(f"Unsupported database type '{db_type}'.")
    return CONNECTOR_ADAPTERS[db_type]

