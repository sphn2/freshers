import io
import csv
import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
try:
    import openpyxl
except ImportError:
    openpyxl = None

from app.db import db
from app.services.audit_service import audit_service

COLUMN_ALIASES = {
    "roll_number": [
        "roll_number", "rollnumber", "roll_no", "rollno", "roll",
        "htno", "hall_ticket", "hallticket", "hall_ticket_number",
        "hallticketnumber", "pin", "student_id", "reg_no", "regno"
    ],
    "full_name": [
        "full_name", "fullname", "student_name", "studentname",
        "name", "candidate_name", "candidatename", "student"
    ],
    "department": [
        "department", "dept", "branch", "course", "stream", "dept_name"
    ],
    "college_name": [
        "college_name", "collegename", "college", "institution",
        "institute", "college_name_override"
    ],
    "email": [
        "email", "email_id", "emailid", "mail", "student_email",
        "student_mail", "e_mail"
    ],
    "phone": [
        "phone", "mobile", "mobile_number", "mobilenumber", "contact",
        "contact_number", "cell", "phone_number", "phonenumber"
    ],
}

def normalize_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(key).strip().lower())

class StudentDirectoryService:
    @staticmethod
    def _map_headers(headers: List[str]) -> Dict[str, int]:
        mapping = {}
        for idx, header in enumerate(headers):
            if not header:
                continue
            norm = normalize_key(header)
            for canonical, aliases in COLUMN_ALIASES.items():
                if canonical not in mapping:
                    if norm in [normalize_key(a) for a in aliases]:
                        mapping[canonical] = idx
                        break
        return mapping

    @staticmethod
    def parse_csv_stream(file_stream: io.BytesIO) -> List[Dict[str, Any]]:
        raw_bytes = file_stream.read()
        for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
            try:
                text = raw_bytes.decode(encoding)
                break
            except UnicodeDecodeError:
                continue
        else:
            raise ValueError("Unable to decode CSV file. Please ensure it is saved in UTF-8 format.")

        reader = csv.reader(io.StringIO(text))
        rows = [row for row in reader if any(cell.strip() for cell in row)]
        if not rows:
            raise ValueError("The uploaded CSV file is empty.")

        header_idx = -1
        col_map = {}
        for idx, row in enumerate(rows):
            tentative_map = StudentDirectoryService._map_headers(row)
            if "roll_number" in tentative_map and "full_name" in tentative_map:
                header_idx = idx
                col_map = tentative_map
                break

        if "roll_number" not in col_map or "full_name" not in col_map:
            detected = [h.strip() for h in rows[0] if h.strip()]
            raise ValueError(
                f"Missing required columns in CSV. Found headers: {detected}. "
                "The file must contain at least 'Roll Number' and 'Full Name' (e.g. roll_no, name)."
            )

        data_rows = []
        for row in rows[header_idx + 1:]:
            if not any(cell.strip() for cell in row):
                continue
            entry = {}
            for col_name, col_i in col_map.items():
                entry[col_name] = row[col_i].strip() if col_i < len(row) else ""
            data_rows.append(entry)
        return data_rows

    @staticmethod
    def parse_excel_stream(file_stream: io.BytesIO) -> List[Dict[str, Any]]:
        if openpyxl is None:
            raise ValueError("Excel file processing is currently unavailable (openpyxl package missing).")
        try:
            wb = openpyxl.load_workbook(file_stream, data_only=True)
        except Exception as e:
            raise ValueError(f"Failed to open Excel workbook: {str(e)}")

        sheet = wb.active
        if not sheet:
            raise ValueError("The uploaded Excel workbook contains no active sheets.")

        all_rows = []
        for row in sheet.iter_rows(values_only=True):
            if any(cell is not None and str(cell).strip() != "" for cell in row):
                all_rows.append([str(c).strip() if c is not None else "" for c in row])

        if not all_rows:
            raise ValueError("The uploaded Excel sheet is empty.")

        header_idx = -1
        col_map = {}
        for idx, row in enumerate(all_rows):
            tentative_map = StudentDirectoryService._map_headers(row)
            if "roll_number" in tentative_map and "full_name" in tentative_map:
                header_idx = idx
                col_map = tentative_map
                break

        if "roll_number" not in col_map or "full_name" not in col_map:
            detected = [h for h in all_rows[0] if h]
            raise ValueError(
                f"Missing required columns in Excel sheet. Found headers: {detected}. "
                "The file must contain at least 'Roll Number' and 'Full Name' (e.g. roll_no, name, dept)."
            )

        data_rows = []
        for row in all_rows[header_idx + 1:]:
            if not any(c for c in row):
                continue
            entry = {}
            for col_name, col_i in col_map.items():
                entry[col_name] = row[col_i] if col_i < len(row) else ""
            data_rows.append(entry)
        return data_rows

    def import_directory_file(self, filename: str, file_stream: io.BytesIO, user_id: Optional[str] = None) -> Dict[str, Any]:
        lower_name = filename.lower()
        if lower_name.endswith(".csv"):
            raw_entries = self.parse_csv_stream(file_stream)
        elif lower_name.endswith((".xlsx", ".xlsm", ".xltx", ".xltm")):
            raw_entries = self.parse_excel_stream(file_stream)
        elif lower_name.endswith(".xls"):
            raise ValueError("Legacy .xls format is not supported. Please save/export as .xlsx or .csv.")
        else:
            raise ValueError("Unsupported file format. Please upload an Excel (.xlsx) or CSV (.csv) file.")

        if not raw_entries:
            raise ValueError("No data records found in the uploaded file.")

        existing_rolls_query = db.execute_query("SELECT roll_number FROM student_directory")
        existing_rolls = {r["roll_number"].upper() for r in existing_rolls_query}

        inserted_count = 0
        updated_count = 0
        skipped_count = 0
        errors = []
        now_iso = datetime.now(timezone.utc).isoformat()

        upsert_query = """
            INSERT INTO student_directory (
                id, roll_number, full_name, email, phone, department, college_name, created_at, updated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT(roll_number) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                department = EXCLUDED.department,
                college_name = EXCLUDED.college_name,
                email = COALESCE(EXCLUDED.email, student_directory.email),
                phone = COALESCE(EXCLUDED.phone, student_directory.phone),
                updated_at = EXCLUDED.updated_at
        """

        with db.transaction():
            for row_num, entry in enumerate(raw_entries, start=2):
                roll = entry.get("roll_number", "").strip().upper()
                name = entry.get("full_name", "").strip()
                dept = entry.get("department", "").strip().upper() or "GENERAL"
                college = entry.get("college_name", "").strip() or "Sphoorthy Engineering College"
                email = entry.get("email", "").strip().lower() or None
                phone = entry.get("phone", "").strip() or None

                if not roll:
                    skipped_count += 1
                    continue
                if not name:
                    skipped_count += 1
                    errors.append(f"Row {row_num}: Skipped missing name for roll '{roll}'")
                    continue

                if roll in existing_rolls:
                    updated_count += 1
                else:
                    inserted_count += 1
                    existing_rolls.add(roll)

                rec_id = str(uuid.uuid4())
                db.execute_write(
                    upsert_query,
                    (rec_id, roll, name, email, phone, dept, college, now_iso, now_iso),
                )

        total_processed = inserted_count + updated_count
        audit_service.log(
            "UPLOAD_STUDENT_DIRECTORY",
            "student_directory",
            None,
            user_id,
            {
                "filename": filename,
                "inserted": inserted_count,
                "updated": updated_count,
                "skipped": skipped_count,
                "total_processed": total_processed,
            },
        )

        return {
            "message": (
                f"Successfully processed {total_processed} student records "
                f"({inserted_count} newly added, {updated_count} updated)."
            ),
            "total_processed": total_processed,
            "inserted": inserted_count,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": errors[:10],
        }

    def get_directory_students(
        self,
        search: Optional[str] = None,
        department: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> Dict[str, Any]:
        page = max(1, page)
        limit = min(max(1, limit), 200)
        offset = (page - 1) * limit

        conditions = []
        params = []

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            conditions.append(
                "(LOWER(roll_number) LIKE %s OR LOWER(full_name) LIKE %s OR LOWER(department) LIKE %s)"
            )
            params.extend([term, term, term])

        if department and department.strip():
            conditions.append("UPPER(department) = %s")
            params.append(department.strip().upper())

        where_clause = f"WHERE {' AND '.join(conditions)}" if conditions else ""

        count_query = f"SELECT COUNT(*) AS total FROM student_directory {where_clause}"
        count_res = db.execute_one(count_query, tuple(params))
        total = count_res["total"] if count_res else 0

        list_query = f"""
            SELECT id, roll_number, full_name, email, phone, department, college_name, created_at, updated_at
            FROM student_directory
            {where_clause}
            ORDER BY roll_number ASC
            LIMIT %s OFFSET %s
        """
        list_params = tuple(params + [limit, offset])
        students = db.execute_query(list_query, list_params)

        return {
            "students": students,
            "total": total,
            "page": page,
            "limit": limit,
            "total_pages": (total + limit - 1) // limit if limit > 0 else 1,
        }

    def get_directory_stats(self) -> Dict[str, Any]:
        total_res = db.execute_one("SELECT COUNT(*) AS total FROM student_directory")
        total = total_res["total"] if total_res else 0

        dept_counts = db.execute_query(
            "SELECT department, COUNT(*) AS count FROM student_directory GROUP BY department ORDER BY count DESC"
        )
        return {
            "total_students": total,
            "departments": dept_counts,
        }

    def delete_student(self, student_id: str, user_id: Optional[str] = None) -> bool:
        record = db.execute_one("SELECT * FROM student_directory WHERE id = %s", (student_id,))
        if not record:
            raise ValueError("Student record not found.")

        db.execute_write("DELETE FROM student_directory WHERE id = %s", (student_id,))
        audit_service.log(
            "DELETE_STUDENT_DIRECTORY_RECORD",
            "student_directory",
            student_id,
            user_id,
            {"roll_number": record["roll_number"], "name": record["full_name"]},
        )
        return True

    def clear_directory(self, user_id: Optional[str] = None) -> int:
        count_res = db.execute_one("SELECT COUNT(*) AS total FROM student_directory")
        total = count_res["total"] if count_res else 0

        db.execute_write("DELETE FROM student_directory")
        audit_service.log(
            "CLEAR_STUDENT_DIRECTORY",
            "student_directory",
            None,
            user_id,
            {"cleared_count": total},
        )
        return total

    @staticmethod
    def generate_csv_template() -> str:
        headers = ["roll_number", "full_name", "department", "college_name", "phone", "email"]
        sample_rows = [
            ["26N81A0501", "Kavya Sharma", "CSE", "Sphoorthy Engineering College", "9876543210", "kavya@sphoorthy.ac.in"],
            ["26N81A0502", "Rahul Varma", "CSE", "Sphoorthy Engineering College", "9876543211", "rahul@sphoorthy.ac.in"],
            ["25N81A0401", "Sneha Reddy", "ECE", "Sphoorthy Engineering College", "9876543212", "sneha@sphoorthy.ac.in"],
        ]
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(sample_rows)
        return output.getvalue()

student_directory_service = StudentDirectoryService()
