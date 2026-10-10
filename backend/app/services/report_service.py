import csv
import io
from app.db import db

class ReportService:
    @staticmethod
    def get_admin_dashboard_metrics(event_id: str = None):
        where_clause = "WHERE event_id = %s" if event_id else ""
        params = (event_id,) if event_id else ()

        with db.transaction():
            reg_stats = db.execute_one(
                f"""SELECT
                COUNT(*) as total_registrations,
                SUM(CASE WHEN status IN ('PAID', 'OFFLINE_PAID') THEN 1 ELSE 0 END) as total_paid,
                SUM(CASE WHEN status = 'PENDING_PAYMENT' THEN 1 ELSE 0 END) as total_pending,
                SUM(CASE WHEN status = 'OFFLINE_PAID' OR payment_method = 'CASH' THEN 1 ELSE 0 END) as total_offline,
                SUM(CASE WHEN status IN ('PAID', 'OFFLINE_PAID') THEN ticket_price ELSE 0 END) as total_revenue,
                SUM(CASE WHEN status = 'PAID' AND payment_method = 'ONLINE' THEN ticket_price ELSE 0 END) as online_revenue,
                SUM(CASE WHEN status = 'OFFLINE_PAID' OR payment_method = 'CASH' THEN ticket_price ELSE 0 END) as offline_revenue
                   FROM registrations {where_clause}""",
                params
            )

            ticket_stats = db.execute_one(
                f"""SELECT
                COUNT(*) as total_tickets,
                SUM(CASE WHEN status = 'GATE_VALIDATED' THEN 1 ELSE 0 END) as gate_validated_count,
                SUM(CASE WHEN status = 'ISSUED' THEN 1 ELSE 0 END) as unvalidated_count
                   FROM tickets {where_clause}""",
                params
            )

            food_stats = db.execute_one(
                f"""SELECT
                COUNT(*) as total_food_entitlements,
                SUM(CASE WHEN status = 'CLAIMED' THEN 1 ELSE 0 END) as food_claimed_count,
                SUM(CASE WHEN status = 'UNCLAIMED' THEN 1 ELSE 0 END) as food_remaining_count
                   FROM food_entitlements {where_clause}""",
                params
            )

        return {
            "total_registrations": reg_stats["total_registrations"] if reg_stats else 0,
            "total_paid": reg_stats["total_paid"] if reg_stats else 0,
            "total_pending": reg_stats["total_pending"] if reg_stats else 0,
            "total_offline": reg_stats["total_offline"] if reg_stats else 0,
            "total_revenue": float(reg_stats["total_revenue"] or 0) if reg_stats else 0.0,
            "online_revenue": float(reg_stats["online_revenue"] or 0) if reg_stats else 0.0,
            "offline_revenue": float(reg_stats["offline_revenue"] or 0) if reg_stats else 0.0,
            "total_tickets": ticket_stats["total_tickets"] if ticket_stats else 0,
            "gate_validated_count": ticket_stats["gate_validated_count"] if ticket_stats else 0,
            "unvalidated_count": ticket_stats["unvalidated_count"] if ticket_stats else 0,
            "food_claimed_count": food_stats["food_claimed_count"] if food_stats else 0,
            "food_remaining_count": food_stats["food_remaining_count"] if food_stats else 0,
        }

    @staticmethod
    def get_registrations_report(event_id: str = None, limit: int = 200):
        if event_id:
            return db.execute_query(
                """SELECT r.id, e.title as event_title, r.full_name, r.roll_number, r.email, r.phone,
                          r.department, r.college, r.status, r.payment_method, r.ticket_price, r.created_at,
                          t.ticket_code, t.status as ticket_status, t.gate_validated_at, fe.status as food_status
                   FROM registrations r
                   JOIN events e ON r.event_id = e.id
                   LEFT JOIN tickets t ON r.id = t.registration_id
                   LEFT JOIN food_entitlements fe ON t.id = fe.ticket_id
                   WHERE r.event_id = %s
                   ORDER BY r.created_at DESC LIMIT %s""",
                (event_id, limit)
            )
        else:
            return db.execute_query(
                """SELECT r.id, e.title as event_title, r.full_name, r.roll_number, r.email, r.phone,
                          r.department, r.college, r.status, r.payment_method, r.ticket_price, r.created_at,
                          t.ticket_code, t.status as ticket_status, t.gate_validated_at, fe.status as food_status
                   FROM registrations r
                   JOIN events e ON r.event_id = e.id
                   LEFT JOIN tickets t ON r.id = t.registration_id
                   LEFT JOIN food_entitlements fe ON t.id = fe.ticket_id
                   ORDER BY r.created_at DESC LIMIT %s""",
                (limit,)
            )

    @staticmethod
    def get_payments_report(event_id: str = None, limit: int = 200):
        if event_id:
            return db.execute_query(
                """SELECT p.id, p.razorpay_order_id, p.razorpay_payment_id, p.amount, p.currency,
                          p.status, p.payment_method, p.created_at,
                          r.id as registration_id, r.full_name, r.roll_number, r.email, r.phone, e.title as event_title,
                          t.ticket_code
                   FROM payments p
                   JOIN registrations r ON p.registration_id = r.id
                   JOIN events e ON r.event_id = e.id
                   LEFT JOIN tickets t ON r.id = t.registration_id
                   WHERE r.event_id = %s
                   ORDER BY p.created_at DESC LIMIT %s""",
                (event_id, limit)
            )
        else:
            return db.execute_query(
                """SELECT p.id, p.razorpay_order_id, p.razorpay_payment_id, p.amount, p.currency,
                          p.status, p.payment_method, p.created_at,
                          r.id as registration_id, r.full_name, r.roll_number, r.email, r.phone, e.title as event_title,
                          t.ticket_code
                   FROM payments p
                   JOIN registrations r ON p.registration_id = r.id
                   JOIN events e ON r.event_id = e.id
                   LEFT JOIN tickets t ON r.id = t.registration_id
                   ORDER BY p.created_at DESC LIMIT %s""",
                (limit,)
            )

    @staticmethod
    def get_gate_entries_report(event_id: str = None, limit: int = 200):
        if event_id:
            return db.execute_query(
                """SELECT t.id, t.ticket_code, t.status, t.gate_validated_at, t.gate_validated_by,
                          t.gate_location, t.gate_method,
                          r.id as registration_id, r.full_name, r.roll_number, r.email, r.phone, r.department, e.title as event_title
                   FROM tickets t
                   JOIN registrations r ON t.registration_id = r.id
                   JOIN events e ON t.event_id = e.id
                   WHERE t.event_id = %s AND t.gate_validated_at IS NOT NULL
                   ORDER BY t.gate_validated_at DESC LIMIT %s""",
                (event_id, limit)
            )
        else:
            return db.execute_query(
                """SELECT t.id, t.ticket_code, t.status, t.gate_validated_at, t.gate_validated_by,
                          t.gate_location, t.gate_method,
                          r.id as registration_id, r.full_name, r.roll_number, r.email, r.phone, r.department, e.title as event_title
                   FROM tickets t
                   JOIN registrations r ON t.registration_id = r.id
                   JOIN events e ON t.event_id = e.id
                   WHERE t.gate_validated_at IS NOT NULL
                   ORDER BY t.gate_validated_at DESC LIMIT %s""",
                (limit,)
            )

    @staticmethod
    def get_offline_collections_report(event_id: str = None, limit: int = 200):
        if event_id:
            return db.execute_query(
                """SELECT oc.id, oc.amount, oc.payment_method, oc.receipt_number, oc.notes, oc.created_at,
                          r.id as registration_id, r.full_name, r.roll_number, r.department, r.email, r.phone, e.title as event_title,
                          t.ticket_code, p.full_name as collector_name, p.email as collector_email
                   FROM offline_collections oc
                   JOIN registrations r ON oc.registration_id = r.id
                   JOIN events e ON oc.event_id = e.id
                   LEFT JOIN tickets t ON r.id = t.registration_id
                   LEFT JOIN profiles p ON oc.collector_id = p.id
                   WHERE oc.event_id = %s
                   ORDER BY oc.created_at DESC LIMIT %s""",
                (event_id, limit)
            )
        else:
            return db.execute_query(
                """SELECT oc.id, oc.amount, oc.payment_method, oc.receipt_number, oc.notes, oc.created_at,
                          r.id as registration_id, r.full_name, r.roll_number, r.department, r.email, r.phone, e.title as event_title,
                          t.ticket_code, p.full_name as collector_name, p.email as collector_email
                   FROM offline_collections oc
                   JOIN registrations r ON oc.registration_id = r.id
                   JOIN events e ON oc.event_id = e.id
                   LEFT JOIN tickets t ON r.id = t.registration_id
                   LEFT JOIN profiles p ON oc.collector_id = p.id
                   ORDER BY oc.created_at DESC LIMIT %s""",
                (limit,)
            )

    @staticmethod
    def export_registrations_csv(event_id: str = None) -> str:
        rows = ReportService.get_registrations_report(event_id=event_id, limit=5000)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Registration ID", "Event Title", "Student Name", "Roll Number", "Email", "Phone",
            "Department", "College", "Reg Status", "Payment Method", "Price (INR)", "Registered At",
            "Ticket Code", "Gate Status", "Gate Validated At", "Food Status"
        ])

        for r in rows:
            values = [
                r["id"], r["event_title"], r["full_name"], r["roll_number"], r["email"], r["phone"],
                r["department"], r["college"], r["status"], r["payment_method"], r["ticket_price"], r["created_at"],
                r.get("ticket_code") or "", r.get("ticket_status") or "", r.get("gate_validated_at") or "", r.get("food_status") or ""
            ]
            safe_values = []
            for value in values:
                if isinstance(value, str):
                    value = value.replace("\r", " ").replace("\n", " ")
                    if value.lstrip(" \t").startswith(("=", "+", "-", "@")):
                        value = "'" + value
                safe_values.append(value)
            writer.writerow([
                *safe_values
            ])

        return output.getvalue()

    @staticmethod
    def get_audit_logs(limit: int = 100):
        return db.execute_query(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT %s",
            (limit,)
        )

report_service = ReportService()
