from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
import os

THAI_FONT_PATH = "THSarabunNew.ttf"
pdfmetrics.registerFont(TTFont("THSarabunNew", THAI_FONT_PATH))

def generate_attendance_pdf(employee_data, attendance_records, output_path):

    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    c.setFont("THSarabunNew", 20)
    c.drawCentredString(width / 2, height - 50, "ใบลงเวลา ประจําเดือน")

    c.setFont("THSarabunNew", 16)
    y_position = height - 80

    details = [
        f"รหัสพนักงาน: {employee_data.get('employee_id', '')}",
        f"ชื่อ-นามสกุล: {employee_data.get('name', '')}",
        f"ประจําหน่วยงาน: {employee_data.get('department', '')}",
        f"สาขา: {employee_data.get('branch', '')}",
        f"เบอร์ติดต่อพนักงาน: {employee_data.get('phone', '')}",
        f"ตำแหน่งงาน: {employee_data.get('position', '')}",
        f"เวลาทํางาน: {employee_data.get('working_hours', '')}"
    ]

    for detail in details:
        c.drawString(50, y_position, detail)
        y_position -= 20


    y_position -= 30
    c.setFont("THSarabunNew", 16)
    headers = ["วันที่", "เข้า", "ออก", "OT 1", "OT 1.5", "OT 2", "OT 3", "ลายเซ็นพนักงาน"]
    col_widths = [60, 60, 60, 50, 50, 50, 50, 100]
    table_x = 50
    row_height = 25

    x_position = table_x
    for i, header in enumerate(headers):
        c.rect(x_position, y_position - row_height, col_widths[i], row_height, stroke=1, fill=0)
        c.drawString(x_position + 5, y_position - row_height + 8, header)
        x_position += col_widths[i]

    y_position -= row_height

    c.setFont("THSarabunNew", 14)

    for record in attendance_records:
        if y_position < 50:
            c.showPage()
            y_position = height - 50
            c.setFont("THSarabunNew", 14)

        row = [
            record.get("date", ""),
            record.get("time_in", ""),
            record.get("time_out", ""),
            str(record.get("ot_1", "")),
            str(record.get("ot_1_5", "")),
            str(record.get("ot_2", "")),
            str(record.get("ot_3", "")),
            record.get("signature", ""),
        ]

        x_position = table_x
        for i, value in enumerate(row):
            c.rect(x_position, y_position - row_height, col_widths[i], row_height, stroke=1, fill=0)  # Draw cell
            c.drawString(x_position + 5, y_position - row_height + 8, value)  # Add text inside
            x_position += col_widths[i]

        y_position -= row_height

    c.setFont("THSarabunNew", 16)
    y_position -= 30
    c.drawString(50, y_position, "ลงชื่อ: .................................................... ผู้ตรวจสอบ")
    c.drawString(350, y_position, "วันที: ................../................../..................")

    y_position -= 30
    c.drawString(50, y_position, "ลงชื่อ: .................................................... ผู้รับรอง")
    c.drawString(350, y_position, "วันที: ................../................../..................")

    c.save()

employee_info = {
    "employee_id": "12345",
    "name": "Tony Stark",
    "department": "IT",
    "branch": "สำนักงานใหญ่",
    "phone": "0812345678",
    "position": "Programmer",
    "working_hours": "08:30 - 17:30"
}

attendance_data = [
    {"date": "01/02/2024", "time_in": "08:30", "time_out": "17:30", "ot_1": "0", "ot_1_5": "1", "ot_2": "0", "ot_3": "0", "signature": ""},
    {"date": "02/02/2024", "time_in": "08:32", "time_out": "18:00", "ot_1": "0.5", "ot_1_5": "0", "ot_2": "1", "ot_3": "0", "signature": ""},
]

generate_attendance_pdf(employee_info, attendance_data, "./testdata/attendance_sheet.pdf")