from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfbase import pdfmetrics
from datetime import datetime
from collections import defaultdict
import os

THAI_FONT_PATH = "THSarabunNew.ttf"
pdfmetrics.registerFont(TTFont("THSarabunNew", THAI_FONT_PATH))

def clean_value(value):
    """Handle null values and convert them to 'None' for header information"""
    if value is None or value == "null" or value == "":
        return "None"
    return str(value)

def clean_table_value(value):
    """Handle null values for table cells - returns empty string instead of 'None'"""
    if value is None or value == "null" or value == "":
        return ""
    return str(value)

def safe_get(dict_data, key, default=""):
    """Safely get value from dictionary even if dict_data is a string"""
    if isinstance(dict_data, dict):
        value = dict_data.get(key, default)
        return clean_value(value)
    return default

def draw_table_header(c, y_position, table_x, col_widths, headers, row_height):
    """Draw table headers"""
    x_position = table_x
    for i, header in enumerate(headers):
        c.rect(x_position, y_position - row_height, col_widths[i], row_height, stroke=1, fill=0)
        c.drawString(x_position + 5, y_position - row_height + 8, header)
        x_position += col_widths[i]
    return y_position - row_height

def process_shift_data(all_shift):
    if not all_shift:
        return []
        
    date_records = defaultdict(lambda: {
        'regular_in': '',
        'regular_out': '',
        'ot_in': '',
        'ot_out': '',
        'duration_regular': '',
        'duration_ot': '',
        'signature': ''
    })
    
    for shift in all_shift:
        if not isinstance(shift, dict):
            continue
            
        date = shift.get('date')
        if not date:
            continue
            
        try:
            # Store original date format for sorting
            parsed_date = datetime.strptime(date, '%Y-%m-%d')
            formatted_date = parsed_date.strftime('%d/%m/%Y')
            
            for shift_type in ['overtime', 'wfh', 'on-site']:
                if shift_type in shift and shift[shift_type]:
                    shifts = shift[shift_type]
                    if not isinstance(shifts, list):
                        continue
                        
                    for s in shifts:
                        if not isinstance(s, dict):
                            continue
                            
                        if shift_type == 'overtime':
                            date_records[date].update({  # Use original date for sorting
                                'ot_in': clean_table_value(s.get('start_official', '')),
                                'ot_out': clean_table_value(s.get('end_official', '')),
                                'duration_ot': clean_table_value(s.get('duration_official', '')),
                                'formatted_date': formatted_date  # Store formatted date separately
                            })
                        else:
                            date_records[date].update({
                                'regular_in': clean_table_value(s.get('start_official', '')),
                                'regular_out': clean_table_value(s.get('end_official', '')),
                                'duration_regular': clean_table_value(s.get('duration_official', '')),
                                'formatted_date': formatted_date
                            })
        except ValueError:
            print(f"Invalid date format found: {date}")
            continue
    
    # Sort records by date and create final list
    sorted_records = []
    for date in sorted(date_records.keys()):  # This will sort by YYYY-MM-DD format
        record = date_records[date]
        sorted_records.append({
            'date': record['formatted_date'],  # Use the formatted date for display
            'regular_in': record['regular_in'],
            'regular_out': record['regular_out'],
            'ot_in': record['ot_in'],
            'ot_out': record['ot_out'],
            'duration_regular': record['duration_regular'],
            'duration_ot': record['duration_ot'],
            'signature': ''
        })
    
    return sorted_records

def generate_attendance_pdf(employee_data, output_path):
    c = canvas.Canvas(output_path, pagesize=A4)
    width, height = A4

    static_data = {
        "employee_id": "TH12345",
        "department": "office",
        "working_hours": "08:30 - 17:30"
    }

    if isinstance(employee_data, dict):
        for key, value in static_data.items():
            if key not in employee_data or not employee_data[key]:
                employee_data[key] = value

    def draw_header_and_details():
        c.setFont("THSarabunNew", 20)
        c.drawCentredString(width / 2, height - 50, "ใบลงเวลา ประจําเดือน")

        c.setFont("THSarabunNew", 16)
        y_pos = height - 80

        details = [
            f"รหัสพนักงาน: {safe_get(employee_data, 'employee_id')}",
            f"ชื่อ-นามสกุล: {safe_get(employee_data, 'name')}",
            f"ประจําหน่วยงาน: {safe_get(employee_data, 'department')}",
            f"สาขา: {safe_get(employee_data, 'branch')}",
            f"อีเมล: {safe_get(employee_data, 'email')}",
            f"ตำแหน่งงาน: {safe_get(employee_data, 'position')}",
            f"เวลาทํางาน: {safe_get(employee_data, 'working_hours')}"
        ]

        for detail in details:
            c.drawString(50, y_pos, detail)
            y_pos -= 20

        return y_pos - 30

    headers = ["วันที่", "เข้า(ปกติ)", "ออก(ปกติ)", "เข้า(OT)", "ออก(OT)", "ชั่วโมงปกติ", "ชั่วโมง OT", "ลายเซ็น"]
    col_widths = [70, 65, 65, 65, 65, 65, 65, 65]
    table_x = 30
    row_height = 25
    min_bottom_margin = 50  # Minimum space to leave at bottom of page

    # Draw initial page
    y_position = draw_header_and_details()
    
    # Draw initial table header
    c.setFont("THSarabunNew", 16)
    y_position = draw_table_header(c, y_position, table_x, col_widths, headers, row_height)

    c.setFont("THSarabunNew", 14)

    all_shift = employee_data.get('all_shift', []) if isinstance(employee_data, dict) else []
    attendance_records = process_shift_data(all_shift)

    for record in attendance_records:
        # Check if we need a new page
        if y_position < (min_bottom_margin + row_height):
            c.showPage()
            c.setFont("THSarabunNew", 16)
            y_position = height - 50
            # Draw headers on new page
            y_position = draw_table_header(c, y_position, table_x, col_widths, headers, row_height)
            c.setFont("THSarabunNew", 14)

        row = [
            record['date'],
            record['regular_in'],
            record['regular_out'],
            record['ot_in'],
            record['ot_out'],
            record['duration_regular'],
            record['duration_ot'],
            record['signature']
        ]

        x_position = table_x
        for i, value in enumerate(row):
            c.rect(x_position, y_position - row_height, col_widths[i], row_height, stroke=1, fill=0)
            c.drawString(x_position + 5, y_position - row_height + 8, clean_table_value(value))
            x_position += col_widths[i]

        y_position -= row_height

    # Draw signatures only if there's enough space, otherwise create new page
    if y_position < (min_bottom_margin + 60):  # 60 is the height needed for signatures
        c.showPage()
        y_position = height - 50

    c.setFont("THSarabunNew", 16)
    y_position -= 30
    c.drawString(50, y_position, "ลงชื่อ: .................................................... ผู้ตรวจสอบ")
    c.drawString(350, y_position, "วันที: ................../................../..................")

    y_position -= 30
    c.drawString(50, y_position, "ลงชื่อ: .................................................... ผู้รับรอง")
    c.drawString(350, y_position, "วันที: ................../................../..................")

    c.save()

def process_all_users(json_data, output_directory="attendance_sheets"):
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
    
    if not isinstance(json_data, list):
        print("Error: Input data must be a list")
        return
        
    for i, user_data in enumerate(json_data):
        if not isinstance(user_data, dict):
            print(f"Skipping invalid user data at index {i}")
            continue
            
        user_id = safe_get(user_data, 'user_id', f'user_{i}')
        filename = f"attendance_sheet_{user_id}.pdf"
        output_path = os.path.join(output_directory, filename)
        
        try:
            generate_attendance_pdf(user_data, output_path)
            print(f"Generated PDF for {safe_get(user_data, 'name', 'Unknown User')} at {output_path}")
        except Exception as e:
            print(f"Error generating PDF for {safe_get(user_data, 'name', 'Unknown User')}: {str(e)}")

# Example JSON data
json_data = [
  {
    "user_id": "user_2srDR9L3cGp4cMwoHChzmGSW6FD",
    "org_id": "org_2riGCGwJV4T5JwxLOFajkNqc03U",
    "name": "Chinathaipan 🐬",
    "avatarUrl": "https://img.clerk.com/eyJ0eXBlIjoicHJveHkiLCJzcmMiOiJodHRwczovL2ltYWdlcy5jbGVyay5kZXYvb2F1dGhfbGluZS9pbWdfMnNyRFI0V2xkTko2WjEzbnlhcDJDc2NOdjdVIn0",
    "branch": "Branch A",
    "workingSummary": "6hrs/2days",
    "status": "offline",
    "email": "cartoonabe@gmail.com",
    "position": "",
    "all_shift": [
      {
        "date": "2025-02-02",
        "overtime": [
          {
            "doc_id": "9M85-5QByn4F19N9AI4v",
            "start": "00:33",
            "end": "00:33",
            "start_official": "21:30",
            "end_official": "02:45",
            "duration": "00:00:11",
            "duration_official": "05:15:00",
            "reason": "[USER] working for OT",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-02-11",
        "on-site": [
          {
            "doc_id": "OUT18JQBJCFmnk-iKuLZ",
            "start": "00:43",
            "end": "01:34",
            "start_official": "00:43",
            "end_official": "01:34",
            "duration": "00:51:46",
            "duration_official": "00:51:46",
            "reason": "No reason provided",
            "change_history": []
          }
        ]
      }
    ]
  },
  {
    "user_id": "user_2riGJwrbjeqS3iHPEcZze9ZheuP",
    "org_id": "org_2riGCGwJV4T5JwxLOFajkNqc03U",
    "name": "null",
    "avatarUrl": "https://img.clerk.com/eyJ0eXBlIjoiZGVmYXVsdCIsImlpZCI6Imluc18ycmhrN1NSbmdycWNNck5xbW9CUnlFZU9SZkoiLCJyaWQiOiJ1c2VyXzJyaUdKd3JiamVxUzNpSFBFY1p6ZTlaaGV1UCJ9",
    "branch": "Branch A",
    "workingSummary": "137hrs/17days",
    "status": "offline",
    "email": "test2@example.com",
    "position": "",
    "all_shift": [
      {
        "date": "2025-01-31",
        "on-site": [
          {
            "doc_id": "vz0wsZQB0ZDgdSeSk3ZV",
            "start": "13:25",
            "end": "21:22",
            "start_official": "13:20",
            "end_official": "21:30",
            "duration": "07:57:24",
            "duration_official": "08:10:00",
            "reason": "Go to other branch",
            "change_history": [
              "[correct shift reason @ 29/01/2025 16:23] Shift reason was updated from '[USER] working regularly' to 'Go to other branch'",
              "[correct shift reason @ 29/01/2025 16:23] Clock-in time was updated from 29/01/2025 22:32 to 29/01/2025 13:25",
              "[correct shift reason @ 29/01/2025 16:23] Clock-out time was updated from 29/01/2025 22:32 to 29/01/2025 21:22"
            ]
          }
        ],
        "overtime": [
          {
            "doc_id": "wD0xsZQB0ZDgdSeSWnbi",
            "start": "21:30",
            "end": "02:45",
            "start_official": "21:30",
            "end_official": "02:45",
            "duration": "05:14:59",
            "duration_official": "05:15:00",
            "reason": "Go to other branch",
            "change_history": [
              "[correct check in and check out time @ 29/01/2025 16:20] Clock-in time was updated from 29/01/2025 22:33 to 31/01/2025 21:30",
              "[correct check in and check out time @ 29/01/2025 16:20] Clock-out time was updated from 29/01/2025 22:33 to 01/02/2025 02:45",
              "[correct shift reason @ 29/01/2025 16:24] Shift reason was updated from '[USER] working for OT' to 'Go to other branch'"
            ]
          }
        ]
      },
      {
        "date": "2025-02-01",
        "overtime": [
          {
            "doc_id": "wT3LsZQB0ZDgdSeSa3Yp",
            "start": "18:30",
            "end": "00:45",
            "start_official": "21:30",
            "end_official": "02:45",
            "duration": "06:14:59",
            "duration_official": "05:15:00",
            "reason": "Go to other branch",
            "change_history": [
              "[correct shift reason @ 29/01/2025 18:22] Shift reason was updated from '[USER] working for OT' to 'Go to other branch'",
              "[correct shift time @ 29/01/2025 18:22] Clock-out time was updated from 30/01/2025 01:21 to 02/02/2025 00:45",
              "[correct shift time @ 29/01/2025 18:25] Clock-in time was updated from 30/01/2025 01:21 to 01/02/2025 18:30",
              "[correct shift time @ 29/01/2025 19:03] Clock-out image was updated"
            ]
          }
        ]
      },
      {
        "date": "2025-02-02",
        "overtime": [
          {
            "doc_id": "wj0EspQB0ZDgdSeS9Hae",
            "start": "02:24",
            "end": "02:24",
            "start_official": "21:30",
            "end_official": "02:45",
            "duration": "00:00:21",
            "duration_official": "05:15:00",
            "reason": "[USER] working for OT",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-02-11",
        "on-site": [
          {
            "doc_id": "M0Tr8JQBJCFmnk-im-Ij",
            "start": "00:32",
            "end": "00:37",
            "start_official": "00:32",
            "end_official": "00:37",
            "duration": "00:05:04",
            "duration_official": "00:05:04",
            "reason": "No reason provided",
            "change_history": []
          },
          {
            "doc_id": "NUTy8JQBJCFmnk-il-J2",
            "start": "00:40",
            "end": "00:40",
            "start_official": "00:40",
            "end_official": "00:40",
            "duration": "00:00:16",
            "duration_official": "00:00:17",
            "reason": "No reason provided",
            "change_history": []
          },
          {
            "doc_id": "N0T08JQBJCFmnk-ituJr",
            "start": "00:42",
            "end": "00:44",
            "start_official": "00:42",
            "end_official": "00:44",
            "duration": "00:01:25",
            "duration_official": "00:01:25",
            "reason": "No reason provided",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-02-14",
        "on-site": [
          {
            "doc_id": "PkRdBJUBJCFmnk-ij-KA",
            "message": "This shift is incomplete and cannot be calculated for summary"
          }
        ]
      },
      {
        "date": "2025-03-01",
        "on-site": [
          {
            "doc_id": "FT2aupQB0ZDgdSeSbHdP",
            "start": "07:30",
            "end": "15:18",
            "start_official": "07:30",
            "end_official": "15:15",
            "duration": "07:47:29",
            "duration_official": "07:45:00",
            "reason": "Regular warehouse operations and order processing",
            "change_history": []
          }
        ],
        "overtime": [
          {
            "doc_id": "MD2aupQB0ZDgdSeSmnc9",
            "start": "15:16",
            "end": "17:45",
            "start_official": "15:15",
            "end_official": "17:45",
            "duration": "02:28:09",
            "duration_official": "02:30:00",
            "reason": "Urgent shipment processing for today",
            "change_history": [
              "[Correct clock-out time @ 31/01/2025 11:25] Clock-in time was updated from 31/01/2025 11:24 to 01/03/2025 15:16",
              "[Correct clock-out time @ 31/01/2025 11:25] Clock-out time was updated from 31/01/2025 11:24 to 01/03/2025 17:45",
              "[Correct shift reasons @ 31/01/2025 11:38] Shift reason was updated from 'Urgent shipment processing for next-day delivery' to 'Urgent shipment processing for today'"
            ]
          }
        ]
      },
      {
        "date": "2025-03-02",
        "on-site": [
          {
            "doc_id": "Fj2aupQB0ZDgdSeSbndo",
            "start": "05:12",
            "end": "13:44",
            "start_official": "05:15",
            "end_official": "13:45",
            "duration": "08:31:57",
            "duration_official": "08:30:00",
            "reason": "Daily inventory management and stock organization",
            "change_history": []
          }
        ],
        "overtime": [
          {
            "doc_id": "MT2aupQB0ZDgdSeSm3fO",
            "start": "13:42",
            "end": "18:11",
            "start_official": "13:45",
            "end_official": "18:15",
            "duration": "04:29:14",
            "duration_official": "04:30:00",
            "reason": "System maintenance and inventory reconciliation",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-03",
        "on-site": [
          {
            "doc_id": "Fz2aupQB0ZDgdSeScHcw",
            "start": "06:15",
            "end": "15:02",
            "start_official": "06:15",
            "end_official": "15:00",
            "duration": "08:47:13",
            "duration_official": "08:45:00",
            "reason": "Standard shipment processing and documentation",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-04",
        "overtime": [
          {
            "doc_id": "Mj2aupQB0ZDgdSeSnXd5",
            "start": "16:45",
            "end": "21:13",
            "start_official": "16:45",
            "end_official": "21:15",
            "duration": "04:27:26",
            "duration_official": "04:30:00",
            "reason": "Peak season order backlog clearance",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-05",
        "on-site": [
          {
            "doc_id": "GD2aupQB0ZDgdSeScnco",
            "start": "07:28",
            "end": "15:32",
            "start_official": "07:30",
            "end_official": "15:30",
            "duration": "08:03:37",
            "duration_official": "08:00:00",
            "reason": "Daily delivery schedule coordination",
            "change_history": []
          }
        ],
        "overtime": [
          {
            "doc_id": "Mz2aupQB0ZDgdSeSnnf6",
            "start": "15:36",
            "end": "16:36",
            "start_official": "15:30",
            "end_official": "16:45",
            "duration": "00:59:49",
            "duration_official": "01:15:00",
            "reason": "Last-minute large customer order fulfillment",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-06",
        "on-site": [
          {
            "doc_id": "GT2aupQB0ZDgdSeSc3ey",
            "start": "06:15",
            "end": "14:59",
            "start_official": "06:15",
            "end_official": "15:00",
            "duration": "08:44:48",
            "duration_official": "08:45:00",
            "reason": "Regular inbound shipment processing",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-07",
        "on-site": [
          {
            "doc_id": "Gj2aupQB0ZDgdSeSdXdB",
            "start": "07:11",
            "end": "16:55",
            "start_official": "07:15",
            "end_official": "16:45",
            "duration": "09:43:39",
            "duration_official": "09:30:00",
            "reason": "Standard inventory receiving and putaway",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-08",
        "on-site": [
          {
            "doc_id": "Gz2aupQB0ZDgdSeSd3cB",
            "start": "06:35",
            "end": "11:31",
            "start_official": "06:30",
            "end_official": "11:30",
            "duration": "04:55:50",
            "duration_official": "05:00:00",
            "reason": "Daily order fulfillment operations",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-09",
        "on-site": [
          {
            "doc_id": "HD2aupQB0ZDgdSeSeXc_",
            "start": "05:47",
            "end": "12:59",
            "start_official": "05:45",
            "end_official": "13:00",
            "duration": "07:11:33",
            "duration_official": "07:15:00",
            "reason": "Regular quality control inspection",
            "change_history": []
          }
        ],
        "overtime": [
          {
            "doc_id": "ND2aupQB0ZDgdSeSoHeb",
            "start": "12:57",
            "end": "17:16",
            "start_official": "13:00",
            "end_official": "17:15",
            "duration": "04:19:01",
            "duration_official": "04:15:00",
            "reason": "Covering for absent team member",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-10",
        "overtime": [
          {
            "doc_id": "NT2aupQB0ZDgdSeSoncX",
            "start": "10:00",
            "end": "15:49",
            "start_official": "10:00",
            "end_official": "15:45",
            "duration": "05:49:32",
            "duration_official": "05:45:00",
            "reason": "End-of-month inventory count and reporting",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-11",
        "on-site": [
          {
            "doc_id": "HT2aupQB0ZDgdSeSe3cb",
            "start": "08:01",
            "end": "18:39",
            "start_official": "08:15",
            "end_official": "18:30",
            "duration": "10:38:29",
            "duration_official": "10:15:00",
            "reason": "Daily route planning and optimization",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-12",
        "on-site": [
          {
            "doc_id": "Hj2aupQB0ZDgdSeSfHe2",
            "start": "06:28",
            "end": "13:48",
            "start_official": "06:30",
            "end_official": "13:45",
            "duration": "07:19:25",
            "duration_official": "07:15:00",
            "reason": "Regular maintenance of warehouse equipment",
            "change_history": []
          }
        ],
        "overtime": [
          {
            "doc_id": "Nj2aupQB0ZDgdSeSo3em",
            "start": "13:46",
            "end": "16:20",
            "start_official": "13:45",
            "end_official": "16:15",
            "duration": "02:34:19",
            "duration_official": "02:30:00",
            "reason": "Special handling required for temperature-sensitive cargo",
            "change_history": []
          }
        ]
      },
      {
        "date": "2025-03-13",
        "on-site": [
          {
            "doc_id": "Hz2aupQB0ZDgdSeSfndQ",
            "start": "09:33",
            "end": "16:10",
            "start_official": "09:30",
            "end_official": "16:15",
            "duration": "06:37:27",
            "duration_official": "06:45:00",
            "reason": "Standard customer order processing",
            "change_history": []
          }
        ]
      }
    ]
  }
]

# Generate PDF for the first user in the JSON data
process_all_users(json_data)