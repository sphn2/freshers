import io
import pytest
import openpyxl
from app import create_app
from app.services.event_service import event_service
from app.services.student_directory_service import student_directory_service
from app.db import db

@pytest.fixture
def client():
    app = create_app()
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client

def test_public_autofill_lookup_without_auth(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    # 21N81A0501 was seeded in db as "Sai Harsha", "CSE"
    res = client.get(f"/api/v1/events/{event['id']}/autofill/21N81A0501")
    assert res.status_code == 200
    data = res.get_json()
    assert data["found"] is True
    assert data["autofill_enabled"] is True
    assert data["full_name"] == "Sai Harsha"
    assert data["department"] == "CSE"
    assert data["roll_number"] == "21N81A0501"

def test_autofill_lookup_nonexistent_roll(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    res = client.get(f"/api/v1/events/{event['id']}/autofill/99NONEXIST99")
    assert res.status_code == 404
    data = res.get_json()
    assert data["found"] is False
    assert data["autofill_enabled"] is True

def test_super_admin_csv_upload_and_upsert(client):
    csv_content = (
        "roll_number,full_name,department,college_name,phone,email\n"
        "26N81A0599,Kavya Directory,CSE,Sphoorthy Engineering College,9123456780,kavya.dir@sphoorthy.ac.in\n"
        "26N81A0598,Aditya Directory,ECE,Sphoorthy Engineering College,9123456781,aditya.dir@sphoorthy.ac.in\n"
    )
    data = {
        "file": (io.BytesIO(csv_content.encode("utf-8")), "students.csv")
    }
    headers = {
        "Authorization": "Bearer test-token-admin",
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Id": "00000000-0000-0000-0000-000000000001",
    }
    res = client.post(
        "/api/v1/admin/student-directory/upload",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )
    assert res.status_code == 200
    res_data = res.get_json()
    assert res_data["inserted"] >= 2

    # Second upload with updated name for Kavya (verifies multiple uploads & upsert)
    csv_content_update = (
        "roll_no,student_name,branch\n"
        "26N81A0599,Kavya Sharma Updated,CSE-AI\n"
        "26N81A0597,New Student Added,CIVIL\n"
    )
    data2 = {
        "file": (io.BytesIO(csv_content_update.encode("utf-8")), "update_batch.csv")
    }
    res2 = client.post(
        "/api/v1/admin/student-directory/upload",
        data=data2,
        content_type="multipart/form-data",
        headers=headers,
    )
    assert res2.status_code == 200
    res2_data = res2.get_json()
    assert res2_data["updated"] >= 1
    assert res2_data["inserted"] >= 1

    # Verify updated record
    rec = db.execute_one("SELECT * FROM student_directory WHERE roll_number = '26N81A0599'")
    assert rec["full_name"] == "Kavya Sharma Updated"
    assert rec["department"] == "CSE-AI"

def test_super_admin_excel_upload(client):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Students"
    ws.append(["HTNO", "Name", "Dept", "College", "Mobile", "Mail"])
    ws.append(["26N81A0999", "Excel Student One", "AIML", "Sphoorthy Engineering College", "9998887771", "ex1@sphoorthy.ac.in"])
    ws.append(["26N81A0998", "Excel Student Two", "DS", "Sphoorthy Engineering College", "9998887772", "ex2@sphoorthy.ac.in"])
    
    excel_stream = io.BytesIO()
    wb.save(excel_stream)
    excel_stream.seek(0)

    data = {
        "file": (excel_stream, "students_batch.xlsx")
    }
    headers = {
        "Authorization": "Bearer test-token-admin",
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Id": "00000000-0000-0000-0000-000000000001",
    }
    res = client.post(
        "/api/v1/admin/student-directory/upload",
        data=data,
        content_type="multipart/form-data",
        headers=headers,
    )
    assert res.status_code == 200
    res_data = res.get_json()
    assert res_data["total_processed"] >= 2

    # Query directory list
    list_res = client.get("/api/v1/admin/student-directory?search=Excel", headers=headers)
    assert list_res.status_code == 200
    assert list_res.get_json()["total"] >= 2

def test_registration_enforces_official_directory_name(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    
    # Insert official student in directory with 26 prefix
    db.execute_write(
        """INSERT INTO student_directory (id, roll_number, full_name, email, phone, department, college_name, created_at)
           VALUES ('test-dir-rahul', '26N81A0502', 'Rahul Varma', 'rahul@sphoorthy.ac.in', '9876543211', 'CSE', 'Sphoorthy Engineering College', '2026-01-01T00:00:00Z')
           ON CONFLICT(roll_number) DO UPDATE SET full_name = EXCLUDED.full_name, department = EXCLUDED.department"""
    )

    # Attacker tries to book ticket using Rahul's roll number but with fake name "Imposter Bob"
    payload = {
        "event_id": event["id"],
        "roll_number": "26N81A0502",
        "full_name": "Imposter Bob",  # Tampered name
        "email": "imposter.bob@test.com",
        "phone": "9887766554",
        "department": "MECHANICAL",   # Tampered dept
        "college": "Sphoorthy Engineering College"
    }
    res = client.post(
        f"/api/v1/events/{event['id']}/register",
        json=payload,
        environ_base={"REMOTE_ADDR": "192.168.1.188"},
    )
    assert res.status_code == 201
    
    reg_id = res.get_json()["registration"]["id"]
    reg = db.execute_one("SELECT full_name, department FROM registrations WHERE id = %s", (reg_id,))
    # Full name and department must be locked to official directory record!
    assert reg["full_name"] == "Rahul Varma"
    assert reg["department"] == "CSE"

def test_toggle_event_autofill(client):
    event = event_service.get_event_by_slug("freshers-2k26")
    headers = {
        "Authorization": "Bearer test-token-admin",
        "X-Test-User-Role": "ADMIN",
        "X-Test-User-Id": "00000000-0000-0000-0000-000000000001",
    }
    
    # Toggle off
    res = client.patch(
        f"/api/v1/admin/events/{event['id']}/toggle-autofill",
        json={"allow_autofill": False},
        headers=headers,
    )
    assert res.status_code == 200
    assert res.get_json()["allow_autofill"] is False

    # Check public autofill returns autofill_enabled = false
    res_pub = client.get(f"/api/v1/events/{event['id']}/autofill/21N81A0501")
    assert res_pub.status_code == 400
    assert res_pub.get_json()["autofill_enabled"] is False

    # Toggle back on
    res2 = client.patch(
        f"/api/v1/admin/events/{event['id']}/toggle-autofill",
        json={"allow_autofill": True},
        headers=headers,
    )
    assert res2.status_code == 200
    assert res2.get_json()["allow_autofill"] is True
