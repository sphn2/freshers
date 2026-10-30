import csv
import io
import uuid
from datetime import datetime, timezone, date, timedelta
from app.db import db
from app.utils.timezone import IST, now_ist_iso, to_ist_date_str, format_ist_display


def _to_ist_date(iso_str: str) -> str:
    """Convert an ISO timestamp string to IST YYYY-MM-DD date string."""
    return to_ist_date_str(iso_str)


def _sql_ist_day(expr: str) -> str:
    """Return SQL expression to format timestamp column/expr as YYYY-MM-DD in IST (Asia/Kolkata)."""
    if getattr(db, "is_sqlite", False):
        return f"strftime('%Y-%m-%d', datetime({expr}, '+5 hours', '+30 minutes'))"
    return f"to_char(({expr})::timestamptz AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD')"


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

            ticket_where = "WHERE t.event_id = %s" if event_id else ""
            ticket_stats = db.execute_one(
                f"""SELECT
                COUNT(*) as total_tickets,
                COUNT(CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '26' THEN 1 END) as first_year_tickets,
                COUNT(CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '25' THEN 1 END) as second_year_tickets,
                SUM(CASE WHEN t.status = 'GATE_VALIDATED' THEN 1 ELSE 0 END) as gate_validated_count,
                SUM(CASE WHEN t.status = 'ISSUED' THEN 1 ELSE 0 END) as unvalidated_count
                   FROM tickets t
                   LEFT JOIN registrations r ON t.registration_id = r.id
                   {ticket_where}""",
                params
            )

            pay_where = "WHERE p.status = 'PAID' AND r.event_id = %s" if event_id else "WHERE p.status = 'PAID'"
            pay_stats = db.execute_one(
                f"""SELECT
                COUNT(p.id) as online_paid_count,
                COALESCE(SUM(p.amount - r.ticket_price), 0) as total_convenience_fee,
                COALESCE(SUM(p.amount), 0) as gross_online_revenue
                   FROM payments p
                   JOIN registrations r ON p.registration_id = r.id
                   {pay_where}""",
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
            "first_year_tickets": ticket_stats["first_year_tickets"] if ticket_stats else 0,
            "second_year_tickets": ticket_stats["second_year_tickets"] if ticket_stats else 0,
            "online_paid_count": pay_stats["online_paid_count"] if pay_stats else 0,
            "total_convenience_fee": float(pay_stats["total_convenience_fee"] or 0) if pay_stats else 0.0,
            "gross_online_revenue": float(pay_stats["gross_online_revenue"] or 0) if pay_stats else 0.0,
            "gate_validated_count": ticket_stats["gate_validated_count"] if ticket_stats else 0,
            "unvalidated_count": ticket_stats["unvalidated_count"] if ticket_stats else 0,
            "food_claimed_count": food_stats["food_claimed_count"] if food_stats else 0,
            "food_remaining_count": food_stats["food_remaining_count"] if food_stats else 0,
        }

    @staticmethod
    def get_registrations_report(
        event_id: str = None,
        limit: int = 5000,
        search: str = None,
        year = None,
        department = None,
        status = None,
        gate_status: str = None,
        food_status: str = None
    ):
        conditions = []
        params = []
        if event_id:
            conditions.append("r.event_id = %s")
            params.append(event_id)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            conditions.append(
                """(LOWER(r.full_name) LIKE %s OR 
                    LOWER(r.roll_number) LIKE %s OR 
                    LOWER(r.email) LIKE %s OR 
                    LOWER(r.phone) LIKE %s OR 
                    LOWER(COALESCE(t.ticket_code, '')) LIKE %s)"""
            )
            params.extend([term, term, term, term, term])

        if year:
            if isinstance(year, str):
                year_list = [y.strip() for y in year.split(",") if y.strip()]
            else:
                year_list = [str(y).strip() for y in year if str(y).strip()]

            prefixes = set()
            for y_item in year_list:
                yl = y_item.lower()
                if "1" in yl or "first" in yl or yl == "26":
                    prefixes.add("26")
                elif "2" in yl or "second" in yl or yl == "25":
                    prefixes.add("25")
                elif len(y_item) == 2 and y_item.isdigit():
                    prefixes.add(y_item)

            year_sub_conds = []
            if prefixes:
                p_placeholders = ", ".join(["%s"] * len(prefixes))
                year_sub_conds.append(f"SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) IN ({p_placeholders})")
                params.extend(list(prefixes))
            if year_sub_conds:
                conditions.append(f"({' OR '.join(year_sub_conds)})")

        if department:
            if isinstance(department, str):
                dept_list = [d.strip() for d in department.split(",") if d.strip()]
            else:
                dept_list = [str(d).strip() for d in department if str(d).strip()]
            if dept_list:
                d_placeholders = ", ".join(["%s"] * len(dept_list))
                conditions.append(f"UPPER(TRIM(r.department)) IN ({d_placeholders})")
                params.extend([d.upper() for d in dept_list])

        if status:
            if isinstance(status, str):
                st_list = [s.strip().upper() for s in status.split(",") if s.strip()]
            else:
                st_list = [str(s).strip().upper() for s in status if str(s).strip()]
            if st_list:
                s_placeholders = ", ".join(["%s"] * len(st_list))
                conditions.append(f"UPPER(TRIM(r.status)) IN ({s_placeholders})")
                params.extend(st_list)

        if gate_status:
            gs = str(gate_status).strip().upper()
            if gs in ("VALIDATED", "YES", "TRUE", "ENTERED"):
                conditions.append("t.gate_validated_at IS NOT NULL")
            elif gs in ("NOT_VALIDATED", "NO", "FALSE", "PENDING"):
                conditions.append("(t.gate_validated_at IS NULL OR t.id IS NULL)")

        if food_status:
            fs = str(food_status).strip().upper()
            if fs in ("CLAIMED", "YES", "TRUE"):
                conditions.append("UPPER(COALESCE(fe.status, '')) = 'CLAIMED'")
            elif fs in ("NOT_CLAIMED", "NO", "FALSE", "PENDING"):
                conditions.append("(fe.status IS NULL OR UPPER(fe.status) != 'CLAIMED')")

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""
        params.append(limit)

        return db.execute_query(
            f"""SELECT r.id, e.title as event_title, r.full_name, r.roll_number,
                      CASE 
                          WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '26' THEN '1st Year'
                          WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '25' THEN '2nd Year'
                          ELSE '—'
                      END as academic_year,
                      r.email, r.phone,
                      r.department, r.college, r.status, r.payment_method, r.ticket_price, r.created_at,
                      t.ticket_code, t.status as ticket_status, t.gate_validated_at, fe.status as food_status
               FROM registrations r
               JOIN events e ON r.event_id = e.id
               LEFT JOIN tickets t ON r.id = t.registration_id
               LEFT JOIN food_entitlements fe ON t.id = fe.ticket_id
               {where_clause}
               ORDER BY r.created_at DESC LIMIT %s""",
            tuple(params)
        )

    @staticmethod
    def get_payments_report(event_id: str = None, limit: int = 2000):
        pay_date_expr = "COALESCE(CASE WHEN p.status = 'PAID' THEN COALESCE(t.created_at, p.updated_at) ELSE p.created_at END, p.created_at)"
        where_clause = "WHERE r.event_id = %s" if event_id else ""
        params = (event_id, limit) if event_id else (limit,)
        return db.execute_query(
            f"""SELECT p.id, p.razorpay_order_id, p.razorpay_payment_id, p.amount, p.currency,
                      p.status, p.payment_method,
                      {pay_date_expr} as created_at,
                      p.updated_at as paid_at,
                      r.id as registration_id, r.full_name, r.roll_number, r.email, r.phone, e.title as event_title,
                      t.ticket_code
               FROM payments p
               JOIN registrations r ON p.registration_id = r.id
               JOIN events e ON r.event_id = e.id
               LEFT JOIN tickets t ON r.id = t.registration_id
               {where_clause}
               ORDER BY {pay_date_expr} DESC LIMIT %s""",
            params
        )

    @staticmethod
    def get_gate_entries_report(event_id: str = None, limit: int = 2000):
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
    def get_offline_collections_report(event_id: str = None, limit: int = 2000):
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
    def export_registrations_csv(
        event_id: str = None,
        search: str = None,
        year = None,
        department = None,
        status = None,
        gate_status: str = None,
        food_status: str = None,
        limit: int = 50000
    ) -> str:
        kwargs = {"event_id": event_id, "limit": limit}
        if search:
            kwargs["search"] = search
        if year:
            kwargs["year"] = year
        if department:
            kwargs["department"] = department
        if status:
            kwargs["status"] = status
        if gate_status:
            kwargs["gate_status"] = gate_status
        if food_status:
            kwargs["food_status"] = food_status

        rows = ReportService.get_registrations_report(**kwargs)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Registration ID", "Event Title", "Student Name", "Roll Number", "Email", "Phone",
            "Department", "Academic Year", "College", "Reg Status", "Payment Method", "Price (INR)", "Registered At (IST)",
            "Ticket Code", "Gate Status", "Gate Validated At (IST)", "Food Status"
        ])

        for r in rows:
            values = [
                r["id"], r["event_title"], r["full_name"], r["roll_number"], r["email"], r["phone"],
                r["department"], r.get("academic_year") or "", r["college"], r["status"], r["payment_method"], r["ticket_price"],
                format_ist_display(r["created_at"]),
                r.get("ticket_code") or "", r.get("ticket_status") or "",
                format_ist_display(r.get("gate_validated_at")),
                r.get("food_status") or ""
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

    # ─────────────────────────────────────────────────────────────
    # NEW: Daily Revenue Report (per-event, per-day, per-channel)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_daily_revenue_report(event_id: str, date_from: str = None, date_to: str = None):
        """
        Returns daily revenue rows for an event, split by ONLINE and CASH channels.
        Each row: { date, channel, tickets_issued, amount, cumulative_tickets, cumulative_amount }
        Also adds a grand totals object at the end.
        """
        # --- ONLINE rows: from payments table (PAID or CAPTURED status) ---
        # Calculate daily rows by successful payment completion date (ticket issued / payment completion date)
        pay_date_expr = "COALESCE(t.created_at, p.updated_at, p.created_at)"
        online_day_expr = _sql_ist_day(pay_date_expr)
        cash_day_expr = _sql_ist_day("oc.created_at")

        online_where = "WHERE r.event_id::text = %s AND (p.status = 'PAID' OR p.status = 'CAPTURED')"
        online_params = [event_id]
        cash_where = "WHERE oc.event_id::text = %s"
        cash_params = [event_id]

        if date_from:
            online_where += f" AND {online_day_expr} >= %s"
            online_params.append(date_from)
            cash_where += f" AND {cash_day_expr} >= %s"
            cash_params.append(date_from)
        if date_to:
            online_where += f" AND {online_day_expr} <= %s"
            online_params.append(date_to)
            cash_where += f" AND {cash_day_expr} <= %s"
            cash_params.append(date_to)

        online_rows = db.execute_query(
            f"""SELECT {online_day_expr} as day,
                       COUNT(DISTINCT CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '26' THEN t.id END) as first_year_tickets,
                       COUNT(DISTINCT CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '25' THEN t.id END) as second_year_tickets,
                       COUNT(DISTINCT CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) NOT IN ('25', '26') THEN t.id END) as other_tickets,
                       COUNT(DISTINCT t.id) as tickets_issued,
                       COALESCE(SUM(r.ticket_price), 0) as amount,
                       COALESCE(SUM(p.amount - r.ticket_price), 0) as convenience_fee,
                       COALESCE(SUM(p.amount), 0) as gross_amount
                FROM payments p
                JOIN registrations r ON p.registration_id = r.id
                LEFT JOIN tickets t ON r.id = t.registration_id
                {online_where}
                GROUP BY {online_day_expr}
                ORDER BY day ASC""",
            tuple(online_params)
        )

        # --- CASH rows: from offline_collections ---
        cash_rows = db.execute_query(
            f"""SELECT {cash_day_expr} as day,
                       COUNT(DISTINCT CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '26' THEN t.id END) as first_year_tickets,
                       COUNT(DISTINCT CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) = '25' THEN t.id END) as second_year_tickets,
                       COUNT(DISTINCT CASE WHEN SUBSTR(UPPER(TRIM(COALESCE(r.roll_number, ''))), 1, 2) NOT IN ('25', '26') THEN t.id END) as other_tickets,
                       COUNT(DISTINCT t.id) as tickets_issued,
                       COALESCE(SUM(oc.amount), 0) as amount,
                       0.0 as convenience_fee,
                       COALESCE(SUM(oc.amount), 0) as gross_amount
                FROM offline_collections oc
                JOIN registrations r ON oc.registration_id = r.id
                LEFT JOIN tickets t ON r.id = t.registration_id
                {cash_where}
                GROUP BY {cash_day_expr}
                ORDER BY day ASC""",
            tuple(cash_params)
        )

        # Build cumulative running totals for each channel
        def add_cumulative(rows, channel):
            cum_tickets = 0
            cum_first = 0
            cum_second = 0
            cum_amount = 0.0
            cum_fee = 0.0
            cum_gross = 0.0
            result = []
            for row in rows:
                first_cnt = int(row.get("first_year_tickets") or 0)
                second_cnt = int(row.get("second_year_tickets") or 0)
                other_cnt = int(row.get("other_tickets") or 0)
                t_issued = int(row.get("tickets_issued") or 0)
                amt = float(row.get("amount") or 0)
                fee = float(row.get("convenience_fee") or 0)
                gross = float(row.get("gross_amount") or (amt + fee))
                cum_first += first_cnt
                cum_second += second_cnt
                cum_tickets += t_issued
                cum_amount += amt
                cum_fee += fee
                cum_gross += gross
                result.append({
                    "date": row["day"],
                    "channel": channel,
                    "first_year_tickets": first_cnt,
                    "second_year_tickets": second_cnt,
                    "other_tickets": other_cnt,
                    "tickets_issued": t_issued,
                    "amount": round(amt, 2),
                    "convenience_fee": round(fee, 2),
                    "gross_amount": round(gross, 2),
                    "cumulative_first_year_tickets": cum_first,
                    "cumulative_second_year_tickets": cum_second,
                    "cumulative_tickets": cum_tickets,
                    "cumulative_amount": round(cum_amount, 2),
                    "cumulative_convenience_fee": round(cum_fee, 2),
                    "cumulative_gross_amount": round(cum_gross, 2),
                })
            return result

        online_data = add_cumulative(online_rows, "ONLINE")
        cash_data = add_cumulative(cash_rows, "CASH")

        # Grand totals
        total_online_first_year_tickets = sum(r["first_year_tickets"] for r in online_data)
        total_online_second_year_tickets = sum(r["second_year_tickets"] for r in online_data)
        total_online_tickets = sum(r["tickets_issued"] for r in online_data)
        total_online_amount = sum(r["amount"] for r in online_data)
        total_online_convenience_fee = sum(r["convenience_fee"] for r in online_data)
        total_online_gross_amount = sum(r["gross_amount"] for r in online_data)

        total_cash_first_year_tickets = sum(r["first_year_tickets"] for r in cash_data)
        total_cash_second_year_tickets = sum(r["second_year_tickets"] for r in cash_data)
        total_cash_tickets = sum(r["tickets_issued"] for r in cash_data)
        total_cash_amount = sum(r["amount"] for r in cash_data)
        total_cash_convenience_fee = sum(r["convenience_fee"] for r in cash_data)
        total_cash_gross_amount = sum(r["gross_amount"] for r in cash_data)

        total_first_year_tickets = total_online_first_year_tickets + total_cash_first_year_tickets
        total_second_year_tickets = total_online_second_year_tickets + total_cash_second_year_tickets
        total_tickets = total_online_tickets + total_cash_tickets
        total_amount = round(total_online_amount + total_cash_amount, 2)
        total_convenience_fee = round(total_online_convenience_fee + total_cash_convenience_fee, 2)
        total_gross_amount = round(total_online_gross_amount + total_cash_gross_amount, 2)

        return {
            "online": online_data,
            "cash": cash_data,
            "totals": {
                "total_online_first_year_tickets": total_online_first_year_tickets,
                "total_online_second_year_tickets": total_online_second_year_tickets,
                "total_online_tickets": total_online_tickets,
                "total_online_amount": round(total_online_amount, 2),
                "total_online_convenience_fee": round(total_online_convenience_fee, 2),
                "total_online_gross_amount": round(total_online_gross_amount, 2),
                "total_cash_first_year_tickets": total_cash_first_year_tickets,
                "total_cash_second_year_tickets": total_cash_second_year_tickets,
                "total_cash_tickets": total_cash_tickets,
                "total_cash_amount": round(total_cash_amount, 2),
                "total_cash_convenience_fee": round(total_cash_convenience_fee, 2),
                "total_cash_gross_amount": round(total_cash_gross_amount, 2),
                "total_first_year_tickets": total_first_year_tickets,
                "total_second_year_tickets": total_second_year_tickets,
                "total_tickets": total_tickets,
                "total_amount": total_amount,
                "total_convenience_fee": total_convenience_fee,
                "total_gross_amount": total_gross_amount,
            }
        }

    # ─────────────────────────────────────────────────────────────
    # NEW: Per-Collector Daily Breakdown
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_daily_collector_breakdown(event_id: str, target_date: str = None):
        """
        Returns per-collector cash breakdown for the given event.
        If target_date is provided, filters to that single day.
        Returns list of { collector_id, collector_name, collector_email, date, tickets_count, total_cash }
        """
        cash_day_expr = _sql_ist_day("oc.created_at")
        where = "WHERE oc.event_id::text = %s"
        params = [event_id]
        if target_date:
            where += f" AND {cash_day_expr} = %s"
            params.append(target_date)

        rows = db.execute_query(
            f"""SELECT {cash_day_expr} as day,
                       oc.collector_id,
                       COALESCE(MAX(p.full_name), 'Unknown') as collector_name,
                       COALESCE(MAX(p.email), '') as collector_email,
                       COUNT(oc.id) as tickets_count,
                       COALESCE(SUM(oc.amount), 0) as total_cash
                FROM offline_collections oc
                LEFT JOIN profiles p ON oc.collector_id::text = p.id::text
                {where}
                GROUP BY {cash_day_expr}, oc.collector_id
                ORDER BY day ASC, total_cash DESC""",
            tuple(params)
        )

        return [
            {
                "date": r["day"],
                "collector_id": r["collector_id"],
                "collector_name": r.get("collector_name") or "Unknown",
                "collector_email": r.get("collector_email") or "",
                "tickets_count": int(r.get("tickets_count") or 0),
                "total_cash": float(r.get("total_cash") or 0),
            }
            for r in rows
        ]

    # ─────────────────────────────────────────────────────────────
    # NEW: Settlement Summary (list of dates + settlement status)
    # ─────────────────────────────────────────────────────────────
    @staticmethod
    def get_settlement_list(event_id: str = None):
        """
        Returns all existing settlement records, optionally filtered by event_id.
        Also enriches each with event title where possible.
        """
        if event_id:
            rows = db.execute_query(
                """SELECT ds.*, e.title as event_title, p.full_name as settler_name, p.email as settler_email
                   FROM daily_settlements ds
                   LEFT JOIN events e ON ds.event_id = e.id::text
                   LEFT JOIN profiles p ON ds.settled_by = p.id::text
                   WHERE ds.event_id = %s
                   ORDER BY ds.settlement_date DESC""",
                (event_id,)
            )
        else:
            rows = db.execute_query(
                """SELECT ds.*, e.title as event_title, p.full_name as settler_name, p.email as settler_email
                   FROM daily_settlements ds
                   LEFT JOIN events e ON ds.event_id = e.id::text
                   LEFT JOIN profiles p ON ds.settled_by = p.id::text
                   ORDER BY ds.settlement_date DESC"""
            )
        return rows or []

    @staticmethod
    def get_settlement_summary(event_id: str = None):
        """Alias for get_settlement_list returning settlement records and summaries."""
        return ReportService.get_settlement_list(event_id=event_id)

    @staticmethod
    def get_settlement_by_id(settlement_id: str):
        """Return a single settlement with event + settler profile details."""
        row = db.execute_one(
            """SELECT ds.*, e.title as event_title, p.full_name as settler_name, p.email as settler_email
               FROM daily_settlements ds
               LEFT JOIN events e ON ds.event_id = e.id::text
               LEFT JOIN profiles p ON ds.settled_by = p.id::text
               WHERE ds.id = %s""",
            (settlement_id,)
        )
        return row

    @staticmethod
    def create_settlement(
        event_id,
        settlement_date: str,
        total_online_amount: float,
        total_cash_amount: float,
        total_tickets_issued: int,
        created_by: str,
    ):
        """Create a new (unsettled) settlement record for a date."""
        # Prevent duplicate for same event+date
        if event_id:
            existing = db.execute_one(
                "SELECT id FROM daily_settlements WHERE settlement_date = %s AND event_id = %s",
                (settlement_date, event_id)
            )
        else:
            existing = db.execute_one(
                "SELECT id FROM daily_settlements WHERE settlement_date = %s AND event_id IS NULL",
                (settlement_date,)
            )
        if existing:
            raise ValueError(f"A settlement record for {settlement_date} already exists.")

        # Generate receipt number: RCPT-YYYYMMDD-NNN
        date_part = settlement_date.replace("-", "")
        count_row = db.execute_one(
            "SELECT COUNT(*) as cnt FROM daily_settlements WHERE substr(settlement_date::text, 1, 7) = %s",
            (settlement_date[:7],)
        )
        seq = (count_row["cnt"] if count_row else 0) + 1
        receipt_number = f"RCPT-{date_part}-{seq:03d}"
        while db.execute_one("SELECT id FROM daily_settlements WHERE receipt_number = %s", (receipt_number,)):
            seq += 1
            receipt_number = f"RCPT-{date_part}-{seq:03d}"

        sid = str(uuid.uuid4())
        now = now_ist_iso()
        total_amount = round(total_online_amount + total_cash_amount, 2)

        db.execute_write(
            """INSERT INTO daily_settlements
               (id, event_id, settlement_date, total_online_amount, total_cash_amount,
                total_tickets_issued, total_amount, is_settled, receipt_number, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (sid, event_id, settlement_date, total_online_amount, total_cash_amount,
             total_tickets_issued, total_amount, False, receipt_number, now, now)
        )
        return db.execute_one("SELECT * FROM daily_settlements WHERE id = %s", (sid,))

    @staticmethod
    def mark_settlement_settled(
        settlement_id: str,
        settled_by: str,
        receiver_name: str,
        bank_name: str,
        account_number: str,
        ifsc_code: str,
        transaction_id: str,
        transaction_date: str,
        notes: str,
        authorized_by_name: str,
    ):
        """Mark a settlement as settled with bank/transaction details."""
        existing = db.execute_one(
            "SELECT id, is_settled FROM daily_settlements WHERE id = %s", (settlement_id,)
        )
        if not existing:
            raise ValueError("Settlement record not found.")
        if existing["is_settled"]:
            raise ValueError("This settlement has already been marked as settled.")

        authorized_by = (authorized_by_name or "SAI HARSHA CHERUKU").strip() or "SAI HARSHA CHERUKU"
        now = now_ist_iso()
        db.execute_write(
            """UPDATE daily_settlements
               SET is_settled = %s, settled_at = %s, settled_by = %s,
                   receiver_name = %s, bank_name = %s, account_number = %s,
                   ifsc_code = %s, transaction_id = %s, transaction_date = %s,
                   notes = %s, authorized_by_name = %s, updated_at = %s
               WHERE id = %s""",
            (True, now, settled_by, receiver_name, bank_name, account_number,
             ifsc_code, transaction_id, transaction_date,
             notes, authorized_by, now, settlement_id)
        )
        return ReportService.get_settlement_by_id(settlement_id)


report_service = ReportService()
