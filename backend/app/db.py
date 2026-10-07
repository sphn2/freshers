import sqlite3
import psycopg2
from psycopg2.extras import RealDictCursor
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
import json
from app.config import config

class DatabaseManager:
    """
    Database Manager supporting both Supabase/PostgreSQL and SQLite (for isolated unit testing).
    Provides parametrized query execution, atomic transactions, and thread safety.
    """
    _instance = None
    _lock = threading.RLock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(DatabaseManager, cls).__new__(cls)
                cls._instance._init_db()
            return cls._instance

    def _init_db(self):
        import os
        self._transaction_local = threading.local()
        self.is_sqlite = config.USE_SQLITE
        self.conn_str = config.DATABASE_URL

        if not self.is_sqlite:
            if not self.conn_str:
                raise RuntimeError("DATABASE_URL is required when SQLite is disabled.")
            try:
                conn = psycopg2.connect(self.conn_str, connect_timeout=3)
                conn.close()
                return
            except psycopg2.Error as exc:
                raise RuntimeError(
                    "PostgreSQL connection failed; refusing to fall back to SQLite."
                ) from exc

        db_path = config.SQLITE_DATABASE_PATH
        if db_path != ":memory:":
            db_path = os.path.abspath(os.path.expanduser(db_path))
            os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.sqlite_conn = sqlite3.connect(db_path, check_same_thread=False)
        self.sqlite_conn.row_factory = sqlite3.Row
        self._create_sqlite_tables()

    def _create_sqlite_tables(self):
        cursor = self.sqlite_conn.cursor()
        cursor.executescript("""
            CREATE TABLE IF NOT EXISTS colleges (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                code TEXT UNIQUE NOT NULL,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                phone TEXT,
                roll_number TEXT,
                department TEXT,
                college_id TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS roles (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT
            );

            CREATE TABLE IF NOT EXISTS user_roles (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                created_at TEXT,
                UNIQUE(user_id, role_id)
            );

            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                slug TEXT UNIQUE NOT NULL,
                description TEXT,
                event_type TEXT DEFAULT 'GENERAL',
                logo_url TEXT,
                banner_url TEXT,
                venue TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                registration_start TEXT NOT NULL,
                registration_end TEXT NOT NULL,
                capacity INTEGER NOT NULL,
                ticket_price REAL NOT NULL DEFAULT 0.0,
                first_year_ticket_price REAL NOT NULL DEFAULT 500.0,
                second_year_ticket_price REAL NOT NULL DEFAULT 600.0,
                other_ticket_price REAL,
                allow_online BOOLEAN DEFAULT TRUE,
                allow_offline BOOLEAN DEFAULT TRUE,
                allow_autofill BOOLEAN DEFAULT TRUE,
                registration_open BOOLEAN DEFAULT NULL,
                gate_validation_enabled BOOLEAN DEFAULT TRUE,
                food_validation_enabled BOOLEAN DEFAULT TRUE,
                status TEXT DEFAULT 'DRAFT',
                created_by TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS event_managers (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT,
                UNIQUE(event_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS student_directory (
                id TEXT PRIMARY KEY,
                roll_number TEXT UNIQUE NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                department TEXT NOT NULL,
                college_name TEXT DEFAULT 'Sphoorthy Engineering College',
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS registrations (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                user_id TEXT,
                full_name TEXT NOT NULL,
                roll_number TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT NOT NULL,
                department TEXT NOT NULL,
                college TEXT NOT NULL DEFAULT 'Sphoorthy Engineering College',
                ticket_price REAL NOT NULL,
                status TEXT DEFAULT 'PENDING_PAYMENT',
                payment_method TEXT DEFAULT 'ONLINE',
                payment_access_token_hash TEXT,
                created_at TEXT,
                updated_at TEXT,
                UNIQUE(event_id, email),
                UNIQUE(event_id, roll_number)
            );

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                registration_id TEXT NOT NULL,
                razorpay_order_id TEXT UNIQUE,
                razorpay_payment_id TEXT UNIQUE,
                razorpay_signature TEXT,
                amount REAL NOT NULL,
                currency TEXT DEFAULT 'INR',
                status TEXT DEFAULT 'CREATED',
                payment_method TEXT DEFAULT 'RAZORPAY',
                idempotency_key TEXT UNIQUE,
                raw_response TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS tickets (
                id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                registration_id TEXT UNIQUE NOT NULL,
                ticket_code TEXT NOT NULL,
                qr_token TEXT UNIQUE NOT NULL,
                public_access_token_hash TEXT,
                status TEXT DEFAULT 'ISSUED',
                gate_validated_at TEXT,
                gate_validated_by TEXT,
                gate_location TEXT,
                gate_method TEXT,
                created_at TEXT,
                updated_at TEXT,
                UNIQUE(event_id, ticket_code)
            );

            CREATE TABLE IF NOT EXISTS food_entitlements (
                id TEXT PRIMARY KEY,
                ticket_id TEXT UNIQUE NOT NULL,
                event_id TEXT NOT NULL,
                status TEXT DEFAULT 'UNCLAIMED',
                food_validated_at TEXT,
                food_validated_by TEXT,
                food_location TEXT,
                food_method TEXT,
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS offline_collections (
                id TEXT PRIMARY KEY,
                collector_id TEXT NOT NULL,
                event_id TEXT NOT NULL,
                registration_id TEXT UNIQUE NOT NULL,
                amount REAL NOT NULL,
                payment_method TEXT DEFAULT 'CASH',
                receipt_number TEXT,
                notes TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS email_logs (
                id TEXT PRIMARY KEY,
                recipient TEXT NOT NULL,
                subject TEXT NOT NULL,
                template_name TEXT NOT NULL,
                status TEXT DEFAULT 'PENDING',
                error_message TEXT,
                metadata TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                action TEXT NOT NULL,
                entity_type TEXT NOT NULL,
                entity_id TEXT,
                details TEXT,
                ip_address TEXT,
                created_at TEXT
            );
        """)
        additive_columns = {
            "events": {
                "first_year_ticket_price": "REAL NOT NULL DEFAULT 500.0",
                "second_year_ticket_price": "REAL NOT NULL DEFAULT 600.0",
                "other_ticket_price": "REAL",
            },
            "registrations": {
                "payment_access_token_hash": "TEXT",
            },
            "tickets": {
                "public_access_token_hash": "TEXT",
            },
        }
        for table, columns in additive_columns.items():
            existing = {
                row["name"]
                for row in cursor.execute(f"PRAGMA table_info({table})").fetchall()
            }
            for column, definition in columns.items():
                if column not in existing:
                    cursor.execute(
                        f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
                    )
        event_columns = {
            row["name"]
            for row in self.sqlite_conn.execute("PRAGMA table_info(events)").fetchall()
        }
        if "registration_open" not in event_columns:
            self.sqlite_conn.execute(
                "ALTER TABLE events ADD COLUMN registration_open BOOLEAN DEFAULT NULL"
            )
        self.sqlite_conn.commit()

        # Seed roles and sample student directory if empty
        self.seed_defaults()

    def seed_defaults(self):
        roles = [
            ('ADMIN', 'College Admin'),
            ('EVENT_MANAGER', 'Event Manager'),
            ('OFFLINE_COLLECTOR', 'Offline Cash Collector'),
            ('GATE_STAFF', 'Gate Entry Staff'),
            ('FOOD_STAFF', 'Food Counter Staff'),
            ('STUDENT', 'Student')
        ]
        for role_name, desc in roles:
            self.execute_write(
                "INSERT INTO roles (id, name, description) VALUES (?, ?, ?) ON CONFLICT(name) DO NOTHING",
                (str(uuid.uuid4()), role_name, desc)
            )
        self.execute_write(
            "DELETE FROM user_roles WHERE role_id IN (SELECT id FROM roles WHERE name NOT IN (?, ?, ?, ?, ?, ?))",
            tuple(role[0] for role in roles),
        )
        self.execute_write(
            "DELETE FROM roles WHERE name NOT IN (?, ?, ?, ?, ?, ?)",
            tuple(role[0] for role in roles),
        )

        # Seed default system staff profile for validation FK constraints
        system_staff_id = "00000000-0000-0000-0000-000000000001"
        self.execute_write(
            """INSERT INTO profiles (id, email, full_name, created_at)
               VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING""",
            (system_staff_id, "staff@sphoorthy.ac.in", "System Staff", datetime.now(timezone.utc).isoformat())
        )

        if config.SEED_DEMO_DATA and not config.is_production:
            sample_students = [
                ("21N81A0501", "Sai Harsha", "harsha@sphoorthy.ac.in", "9876543210", "CSE"),
                ("21N81A0502", "Rahul Varma", "rahul@sphoorthy.ac.in", "9876543211", "CSE"),
                ("21N81A0401", "Sneha Reddy", "sneha@sphoorthy.ac.in", "9876543212", "ECE"),
                ("21N81A0301", "Anish Sharma", "anish@sphoorthy.ac.in", "9876543213", "MECHANICAL")
            ]
            for roll, name, email, phone, dept in sample_students:
                self.execute_write(
                    """INSERT INTO student_directory (id, roll_number, full_name, email, phone, department, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(roll_number) DO NOTHING""",
                    (str(uuid.uuid4()), roll, name, email, phone, dept, datetime.now(timezone.utc).isoformat())
                )

    @contextmanager
    def transaction(self):
        """Run related database operations on one connection and commit them together."""
        active_connection = getattr(self._transaction_local, "connection", None)
        if active_connection is not None:
            yield
            return

        if self.is_sqlite:
            self._lock.acquire()
            connection = self.sqlite_conn
            try:
                connection.execute("BEGIN IMMEDIATE")
            except BaseException:
                self._lock.release()
                raise
        else:
            connection = psycopg2.connect(self.conn_str, connect_timeout=3)

        self._transaction_local.connection = connection
        try:
            yield
            connection.commit()
        except BaseException:
            connection.rollback()
            raise
        finally:
            del self._transaction_local.connection
            if not self.is_sqlite:
                connection.close()
            else:
                self._lock.release()

    def execute_query(self, query: str, params: tuple = ()):
        """Executes a SELECT query and returns a list of dictionaries."""
        active_connection = getattr(self._transaction_local, "connection", None)
        if active_connection is not None:
            q = query.replace("::boolean", "").replace("%s", "?") if self.is_sqlite else query.replace("?", "%s")
            cursor = (
                active_connection.cursor()
                if self.is_sqlite
                else active_connection.cursor(cursor_factory=RealDictCursor)
            )
            try:
                cursor.execute(q, params)
                return [dict(row) for row in cursor.fetchall()]
            finally:
                cursor.close()

        if self.is_sqlite:
            with self._lock:
                q = query.replace("::boolean", "").replace("%s", "?")
                cursor = self.sqlite_conn.cursor()
                try:
                    cursor.execute(q, params)
                    rows = cursor.fetchall()
                    return [dict(row) for row in rows]
                finally:
                    cursor.close()
        else:
            q = query.replace("?", "%s")
            conn = psycopg2.connect(self.conn_str, connect_timeout=3)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(q, params)
                    rows = cursor.fetchall()
                    return [dict(r) for r in rows]
            finally:
                conn.close()

    def execute_one(self, query: str, params: tuple = ()):
        rows = self.execute_query(query, params)
        return rows[0] if rows else None

    def execute_write(self, query: str, params: tuple = ()):
        """Executes INSERT, UPDATE, DELETE query and returns modified count / returning row."""
        active_connection = getattr(self._transaction_local, "connection", None)
        if active_connection is not None:
            q = query.replace("::boolean", "").replace("%s", "?") if self.is_sqlite else query.replace("?", "%s")
            cursor = (
                active_connection.cursor()
                if self.is_sqlite
                else active_connection.cursor(cursor_factory=RealDictCursor)
            )
            try:
                cursor.execute(q, params)
                if cursor.description:
                    return [dict(row) for row in cursor.fetchall()]
                return cursor.rowcount
            finally:
                cursor.close()

        if self.is_sqlite:
            with self._lock:
                q = query.replace("::boolean", "").replace("%s", "?")
                cursor = self.sqlite_conn.cursor()
                try:
                    cursor.execute(q, params)
                    self.sqlite_conn.commit()
                    rowcount = cursor.rowcount
                    return rowcount
                finally:
                    cursor.close()
        else:
            q = query.replace("?", "%s")
            conn = psycopg2.connect(self.conn_str, connect_timeout=3)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(q, params)
                    conn.commit()
                    if cursor.description:
                        rows = cursor.fetchall()
                        return [dict(r) for r in rows]
                    return cursor.rowcount
            finally:
                conn.close()

    def execute_atomic_update(self, update_query: str, params: tuple):
        """
        Executes atomic update (e.g., gate validation or food validation) and returns updated row.
        Guarantees single execution in concurrent environments.
        """
        active_connection = getattr(self._transaction_local, "connection", None)
        if active_connection is not None:
            q = update_query.replace("::boolean", "").replace("%s", "?") if self.is_sqlite else update_query.replace("?", "%s")
            cursor = (
                active_connection.cursor()
                if self.is_sqlite
                else active_connection.cursor(cursor_factory=RealDictCursor)
            )
            try:
                cursor.execute(q, params)
                row = cursor.fetchone() if cursor.description else None
                if row is None and cursor.rowcount == 0:
                    return None
                return dict(row) if row else True
            finally:
                cursor.close()

        if self.is_sqlite:
            with self._lock:
                q = update_query.replace("::boolean", "").replace("%s", "?")
                cursor = self.sqlite_conn.cursor()
                try:
                    cursor.execute(q, params)
                    row = cursor.fetchone() if cursor.description else None
                    self.sqlite_conn.commit()
                    if row is None and cursor.rowcount == 0:
                        return None
                    return dict(row) if row else True
                finally:
                    cursor.close()
        else:
            q = update_query.replace("?", "%s")
            conn = psycopg2.connect(self.conn_str, connect_timeout=3)
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cursor:
                    cursor.execute(q, params)
                    conn.commit()
                    rows = cursor.fetchall()
                    return dict(rows[0]) if rows else None
            finally:
                conn.close()


db = DatabaseManager()
