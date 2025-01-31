from datetime import datetime, timedelta
import random
from elasticsearch import Elasticsearch
import requests
from typing import List, Tuple, Optional


def add_time_variation(base_time, is_clock_in=True):
    # 60% chance to be on time (±3 minutes)
    if random.random() < 0.6:
        variation_minutes = random.uniform(-3, 3)
    else:
        # For the 40% early/late cases, determine the range
        rand = random.random()
        if rand < 0.5:  # 50% of 40% = 20% chance
            variation_minutes = random.uniform(3, 5) if random.random() < 0.5 else random.uniform(-5, -3)
        elif rand < 0.8:  # 30% of 40% = 12% chance
            variation_minutes = random.uniform(5, 10) if random.random() < 0.5 else random.uniform(-10, -5)
        elif rand < 0.9:  # 20% of 40% = 8% chance
            variation_minutes = random.uniform(10, 15) if random.random() < 0.5 else random.uniform(-15, -10)
        else:  # 10% of 40% = 4% chance
            variation_minutes = random.uniform(15, 20) if random.random() < 0.5 else random.uniform(-20, -15)
    
    base_datetime = datetime.strptime(base_time, "%Y-%m-%dT%H:%M:%S.000Z")
    
    # Add random seconds and milliseconds
    random_seconds = random.randint(0, 59)
    random_milliseconds = random.randint(0, 999)
    
    # Add the variations
    actual_time = base_datetime + timedelta(
        minutes=variation_minutes,
        seconds=random_seconds,
        microseconds=random_milliseconds * 1000  # convert to microseconds
    )
    
    # Format with random milliseconds
    return actual_time.strftime("%Y-%m-%dT%H:%M:%S.") + f"{random_milliseconds:03d}Z"

def generate_shifts():
    regular_shifts = []
    ot_shifts = []
    
    # Generate regular shifts
    for day in range(1, 32):
        local_hour = random.randint(5, 9)
        local_minute = random.choice([0, 15, 30, 45])
        
        # Convert to UTC by subtracting 7 hours
        utc_hour = local_hour - 7
        
        actual_day = day
        if utc_hour < 0:
            utc_hour += 24
            actual_day -= 1
        
        # Create official times for regular shift
        clock_in_time = datetime(2025, 3, actual_day, utc_hour, local_minute)
        
        shift_duration = timedelta(
            hours=random.randint(5, 10),
            minutes=random.choice([0, 15, 30, 45])
        )
        clock_out_time = clock_in_time + shift_duration
        
        # Convert to ISO format strings
        official_in = clock_in_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        official_out = clock_out_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
        
        # Generate actual clock in/out times with variations
        actual_in = add_time_variation(official_in, is_clock_in=True)
        actual_out = add_time_variation(official_out, is_clock_in=False)
        
        regular_shifts.append(((official_in, official_out), (actual_in, actual_out)))
        
        # Generate OT shift for some days (same probability as before)
        if random.random() < 0.5:  # About 50% chance for OT
            # OT starts at regular shift end
            ot_start_time = clock_out_time
            
            ot_duration = timedelta(
                hours=random.randint(1, 5),
                minutes=random.choice([0, 15, 30, 45])
            )
            ot_end_time = ot_start_time + ot_duration
            
            official_ot_in = ot_start_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            official_ot_out = ot_end_time.strftime("%Y-%m-%dT%H:%M:%S.000Z")
            
            # Generate actual OT clock in/out times with variations
            actual_ot_in = add_time_variation(official_ot_in, is_clock_in=True)
            actual_ot_out = add_time_variation(official_ot_out, is_clock_in=False)
            
            ot_shifts.append(((official_ot_in, official_ot_out), (actual_ot_in, actual_ot_out)))
    
    return regular_shifts, ot_shifts

def generate_location_pairs():
    # Bangkok boundaries (approximate)
    BANGKOK_BOUNDS = {
        'min_lat': 13.5136,
        'max_lat': 13.9571,
        'min_lon': 100.3331,
        'max_lon': 100.9360
    }
    
    # Common locations in Bangkok (to make it more realistic)
    COMMON_LOCATIONS = [
        (13.7563, 100.5018),  # Central Bangkok
        (13.6517, 100.6936),  # Bang Na
        (13.8088, 100.5615),  # Don Mueang
        (13.7246, 100.5927),  # Lat Phrao
        (13.6959, 100.5408),  # Din Daeng
        (13.7137, 100.7157),  # Min Buri
        (13.8619, 100.5960)   # Khlong Sam Wa
    ]

    locations = []
    
    for _ in range(31):
        # 70% chance to use a common location, 30% chance for random location
        if random.random() < 0.7:
            base_lat, base_lon = random.choice(COMMON_LOCATIONS)
        else:
            base_lat = random.uniform(BANGKOK_BOUNDS['min_lat'], BANGKOK_BOUNDS['max_lat'])
            base_lon = random.uniform(BANGKOK_BOUNDS['min_lon'], BANGKOK_BOUNDS['max_lon'])
        
        # Generate small variations for clock-in and clock-out
        # Maximum variation of about 50 meters (approximately 0.0005 degrees)
        variation_lat = random.uniform(-0.0005, 0.0005)
        variation_lon = random.uniform(-0.0005, 0.0005)
        
        # Clock-in location
        clock_in_lat = round(base_lat + random.uniform(-0.0001, 0.0001), 6)
        clock_in_lon = round(base_lon + random.uniform(-0.0001, 0.0001), 6)
        
        # Clock-out location (slightly different from clock-in)
        clock_out_lat = round(clock_in_lat + variation_lat, 6)
        clock_out_lon = round(clock_in_lon + variation_lon, 6)
        
        locations.append(((clock_in_lat, clock_in_lon), (clock_out_lat, clock_out_lon)))
    
    return locations


# # Print location
# locations = generate_location_pairs()
# print("location_pairs = [")
# for i, ((in_lat, in_lon), (out_lat, out_lon)) in enumerate(locations):
#     print(f"    (({in_lat}, {in_lon}), ({out_lat}, {out_lon})){',' if i < len(locations)-1 else ''}")
# print("]")



# # Generate and print the shifts
# regular_shifts, ot_shifts = generate_shifts()

# # Print regular shifts
# print("regular_shifts = [")
# for i, ((off_in, off_out), (act_in, act_out)) in enumerate(regular_shifts):
#     print(f"    (('{off_in}', '{off_out}'), ('{act_in}', '{act_out}')){',' if i < len(regular_shifts)-1 else ''}")
# print("]")

# # Print OT shifts
# print("\not_shifts = [")
# for i, ((off_in, off_out), (act_in, act_out)) in enumerate(ot_shifts):
#     print(f"    (('{off_in}', '{off_out}'), ('{act_in}', '{act_out}')){',' if i < len(ot_shifts)-1 else ''}")
# print("]")

########################################################################################################################

regular_location = [
    ((13.808766, 100.561561), (13.808962, 100.561697)),
    ((13.938192, 100.807274), (13.938609, 100.807311)),
    ((13.861817, 100.595922), (13.862014, 100.596084)),
    ((13.861957, 100.595967), (13.862281, 100.59547)),
    ((13.724662, 100.592702), (13.724855, 100.593101)),
    ((13.659185, 100.548059), (13.659628, 100.547588)),
    ((13.695824, 100.540757), (13.695658, 100.540461)),
    ((13.756282, 100.501707), (13.756554, 100.501304)),
    ((13.605884, 100.861445), (13.606363, 100.861636)),
    ((13.808773, 100.56147), (13.809252, 100.561782)),
    ((13.808708, 100.561403), (13.809116, 100.560911)),
    ((13.861971, 100.595953), (13.861667, 100.596393)),
    ((13.713783, 100.715791), (13.713646, 100.715799)),
    ((13.802521, 100.809496), (13.802972, 100.809432)),
    ((13.724646, 100.592786), (13.724939, 100.592484)),
    ((13.724691, 100.592733), (13.72426, 100.59311)),
    ((13.735592, 100.736951), (13.736025, 100.737346)),
    ((13.651685, 100.69365), (13.652035, 100.693318)),
    ((13.583591, 100.666307), (13.583693, 100.666466)),
    ((13.604536, 100.531974), (13.604773, 100.531793)),
    ((13.861803, 100.595914), (13.861928, 100.596175)),
    ((13.861899, 100.596023), (13.862012, 100.595839)),
    ((13.724532, 100.59267), (13.724188, 100.592625)),
    ((13.651651, 100.693645), (13.651318, 100.693265)),
    ((13.724528, 100.592705), (13.72417, 100.593088)),
    ((13.695838, 100.54077), (13.695986, 100.541104)),
    ((13.724682, 100.592756), (13.724998, 100.592344)),
    ((13.80881, 100.561493), (13.809073, 100.56197)),
    ((13.713774, 100.715667), (13.713328, 100.716025)),
    ((13.861976, 100.595905), (13.861513, 100.596227)),
    ((13.774793, 100.39318), (13.774319, 100.393216))
]

regular_shifts = [
    (('2025-03-01T00:30:00.000Z', '2025-03-01T08:15:00.000Z'), ('2025-03-01T00:30:50.419Z', '2025-03-01T08:18:19.915Z')), # OT Day
    (('2025-03-01T22:15:00.000Z', '2025-03-02T06:45:00.000Z'), ('2025-03-01T22:12:55.176Z', '2025-03-02T06:44:52.534Z')), # OT Day
    (('2025-03-02T23:15:00.000Z', '2025-03-03T08:00:00.000Z'), ('2025-03-02T23:15:12.508Z', '2025-03-03T08:02:26.322Z')),
    # (('2025-03-04T01:15:00.000Z', '2025-03-04T09:45:00.000Z'), ('2025-03-04T01:22:52.239Z', '2025-03-04T09:48:07.816Z')), # OT only
    (('2025-03-05T00:30:00.000Z', '2025-03-05T08:30:00.000Z'), ('2025-03-05T00:28:55.296Z', '2025-03-05T08:32:33.001Z')), # OT Day
    (('2025-03-05T23:15:00.000Z', '2025-03-06T08:00:00.000Z'), ('2025-03-05T23:15:03.726Z', '2025-03-06T07:59:51.941Z')),
    (('2025-03-07T00:15:00.000Z', '2025-03-07T09:45:00.000Z'), ('2025-03-07T00:11:56.435Z', '2025-03-07T09:55:36.265Z')),
    (('2025-03-07T23:30:00.000Z', '2025-03-08T04:30:00.000Z'), ('2025-03-07T23:35:12.438Z', '2025-03-08T04:31:02.842Z')),
    (('2025-03-08T22:45:00.000Z', '2025-03-09T06:00:00.000Z'), ('2025-03-08T22:47:42.757Z', '2025-03-09T05:59:16.408Z')), # OT Day
    # (('2025-03-09T22:00:00.000Z', '2025-03-10T03:00:00.000Z'), ('2025-03-09T22:07:45.647Z', '2025-03-10T03:03:03.979Z')), # OT only
    (('2025-03-11T01:15:00.000Z', '2025-03-11T11:30:00.000Z'), ('2025-03-11T01:01:15.660Z', '2025-03-11T11:39:45.526Z')),
    (('2025-03-11T23:30:00.000Z', '2025-03-12T06:45:00.000Z'), ('2025-03-11T23:28:38.558Z', '2025-03-12T06:48:04.251Z')), # OT Day
    (('2025-03-13T02:30:00.000Z', '2025-03-13T09:15:00.000Z'), ('2025-03-13T02:33:03.994Z', '2025-03-13T09:10:31.367Z')),
    (('2025-03-13T23:30:00.000Z', '2025-03-14T09:15:00.000Z'), ('2025-03-13T23:25:36.658Z', '2025-03-14T09:14:02.688Z')), # OT Day
    (('2025-03-15T00:30:00.000Z', '2025-03-15T10:15:00.000Z'), ('2025-03-15T00:30:31.191Z', '2025-03-15T10:15:30.483Z')),
    # (('2025-03-15T23:30:00.000Z', '2025-03-16T05:30:00.000Z'), ('2025-03-15T23:33:02.608Z', '2025-03-16T05:31:00.100Z')), # OT only
    (('2025-03-17T00:45:00.000Z', '2025-03-17T11:15:00.000Z'), ('2025-03-17T00:45:30.699Z', '2025-03-17T11:23:21.497Z')),
    (('2025-03-18T00:00:00.000Z', '2025-03-18T09:30:00.000Z'), ('2025-03-18T00:17:02.873Z', '2025-03-18T09:29:53.590Z')),
    (('2025-03-19T02:45:00.000Z', '2025-03-19T08:45:00.000Z'), ('2025-03-19T02:46:01.758Z', '2025-03-19T08:45:42.468Z')), # Edit
    (('2025-03-19T22:30:00.000Z', '2025-03-20T03:45:00.000Z'), ('2025-03-19T22:32:29.957Z', '2025-03-20T03:44:33.402Z')),
    (('2025-03-21T00:00:00.000Z', '2025-03-21T10:45:00.000Z'), ('2025-03-21T00:18:17.384Z', '2025-03-21T10:46:57.858Z')),
    (('2025-03-22T02:00:00.000Z', '2025-03-22T10:15:00.000Z'), ('2025-03-22T02:03:38.701Z', '2025-03-22T10:17:28.601Z')), # OT Day
    (('2025-03-23T02:15:00.000Z', '2025-03-23T07:45:00.000Z'), ('2025-03-23T01:55:53.960Z', '2025-03-23T07:44:25.407Z')), # Edit
    (('2025-03-24T00:45:00.000Z', '2025-03-24T09:00:00.000Z'), ('2025-03-24T00:47:38.011Z', '2025-03-24T09:07:09.079Z')),
    (('2025-03-24T22:30:00.000Z', '2025-03-25T07:15:00.000Z'), ('2025-03-24T22:27:40.703Z', '2025-03-25T07:33:55.307Z')), # OT Day
    (('2025-03-25T22:45:00.000Z', '2025-03-26T07:30:00.000Z'), ('2025-03-25T22:46:53.548Z', '2025-03-26T07:27:07.926Z')), # OT Day
    # (('2025-03-27T02:00:00.000Z', '2025-03-27T10:30:00.000Z'), ('2025-03-27T01:58:04.715Z', '2025-03-27T10:39:53.993Z')), # OT only
    (('2025-03-27T22:00:00.000Z', '2025-03-28T08:00:00.000Z'), ('2025-03-27T22:01:21.359Z', '2025-03-28T08:05:54.609Z')),
    (('2025-03-29T02:00:00.000Z', '2025-03-29T10:15:00.000Z'), ('2025-03-29T01:58:18.130Z', '2025-03-29T10:12:02.709Z')),
    (('2025-03-30T00:45:00.000Z', '2025-03-30T09:45:00.000Z'), ('2025-03-30T00:50:57.749Z', '2025-03-30T09:41:53.282Z')), # OT Day
    (('2025-03-30T23:15:00.000Z', '2025-03-31T06:30:00.000Z'), ('2025-03-30T23:14:27.044Z', '2025-03-31T06:33:35.564Z')) # Edit
]

regular_reasons = [
    "Regular warehouse operations and order processing",
    "Daily inventory management and stock organization",
    "Standard shipment processing and documentation",
    # "Routine order picking and packing",
    "Daily delivery schedule coordination",
    "Regular inbound shipment processing",
    "Standard inventory receiving and putaway",
    "Daily order fulfillment operations",
    "Regular quality control inspection",
    # "Standard cross-docking operations",
    "Daily route planning and optimization",
    "Regular maintenance of warehouse equipment",
    "Standard customer order processing",
    "Daily supply chain coordination",
    "Regular packaging material management",
    # "Standard warehouse cleaning and organization",
    "Daily safety inspection and compliance checks",
    "Regular inventory location optimization",
    "Standard returns processing",
    "Daily team coordination and task assignment",
    "Regular equipment maintenance checks",
    "Standard shipment documentation processing",
    "Daily customer inquiry handling",
    "Regular stock rotation tasks",
    "Standard loading dock operations",
    "Daily inventory accuracy checks",
    # "Regular order verification and quality checks",
    "Standard warehouse security procedures",
    "Daily dispatch coordination",
    "Regular material handling operations",
    "Standard end-of-day reporting and handover"
]

ot_location = [
    ((13.808766, 100.561561), (13.808962, 100.561697)),
    ((13.938192, 100.807274), (13.938609, 100.807311)),
    # ((13.861817, 100.595922), (13.862014, 100.596084)),
    ((13.861957, 100.595967), (13.862281, 100.59547)),
    ((13.724662, 100.592702), (13.724855, 100.593101)),
    # ((13.659185, 100.548059), (13.659628, 100.547588)),
    # ((13.695824, 100.540757), (13.695658, 100.540461)),
    # ((13.756282, 100.501707), (13.756554, 100.501304)),
    ((13.605884, 100.861445), (13.606363, 100.861636)),
    ((13.808773, 100.56147), (13.809252, 100.561782)),
    # ((13.808708, 100.561403), (13.809116, 100.560911)),
    ((13.861971, 100.595953), (13.861667, 100.596393)),
    # ((13.713783, 100.715791), (13.713646, 100.715799)),
    ((13.802521, 100.809496), (13.802972, 100.809432)),
    # ((13.724646, 100.592786), (13.724939, 100.592484)),
    ((13.724691, 100.592733), (13.72426, 100.59311)),
    # ((13.735592, 100.736951), (13.736025, 100.737346)),
    # ((13.651685, 100.69365), (13.652035, 100.693318)),
    # ((13.583591, 100.666307), (13.583693, 100.666466)),
    # ((13.604536, 100.531974), (13.604773, 100.531793)),
    # ((13.861803, 100.595914), (13.861928, 100.596175)),
    ((13.861899, 100.596023), (13.862012, 100.595839)),
    # ((13.724532, 100.59267), (13.724188, 100.592625)),
    # ((13.651651, 100.693645), (13.651318, 100.693265)),
    ((13.724528, 100.592705), (13.72417, 100.593088)),
    ((13.695838, 100.54077), (13.695986, 100.541104)),
    ((13.724682, 100.592756), (13.724998, 100.592344)),
    # ((13.80881, 100.561493), (13.809073, 100.56197)),
    # ((13.713774, 100.715667), (13.713328, 100.716025)),
    ((13.861976, 100.595905), (13.861513, 100.596227)),
    # ((13.774793, 100.39318), (13.774319, 100.393216))
]

ot_shifts = [
    (('2025-03-01T08:15:00.000Z', '2025-03-01T10:45:00.000Z'), ('2025-03-01T08:16:50.920Z', '2025-03-01T10:48:56.957Z')), # Edit
    (('2025-03-02T06:45:00.000Z', '2025-03-02T11:15:00.000Z'), ('2025-03-02T06:42:13.752Z', '2025-03-02T11:11:28.568Z')),
    (('2025-03-04T09:45:00.000Z', '2025-03-04T14:15:00.000Z'), ('2025-03-04T09:45:39.048Z', '2025-03-04T14:13:05.481Z')), # OT only
    (('2025-03-05T08:30:00.000Z', '2025-03-05T09:45:00.000Z'), ('2025-03-05T08:36:53.357Z', '2025-03-05T09:36:42.628Z')),
    (('2025-03-09T06:00:00.000Z', '2025-03-09T10:15:00.000Z'), ('2025-03-09T05:57:43.232Z', '2025-03-09T10:16:44.258Z')),
    (('2025-03-10T03:00:00.000Z', '2025-03-10T08:45:00.000Z'), ('2025-03-10T03:00:17.278Z', '2025-03-10T08:49:49.766Z')), # OT only
    (('2025-03-12T06:45:00.000Z', '2025-03-12T09:15:00.000Z'), ('2025-03-12T06:46:16.961Z', '2025-03-12T09:20:36.863Z')),
    (('2025-03-14T09:15:00.000Z', '2025-03-14T10:45:00.000Z'), ('2025-03-14T09:16:50.175Z', '2025-03-14T10:44:45.920Z')),
    (('2025-03-16T05:30:00.000Z', '2025-03-16T10:30:00.000Z'), ('2025-03-16T05:29:20.144Z', '2025-03-16T10:31:06.593Z')), # OT only
    (('2025-03-22T10:15:00.000Z', '2025-03-22T14:15:00.000Z'), ('2025-03-22T10:13:32.335Z', '2025-03-22T14:21:45.801Z')),
    (('2025-03-25T07:15:00.000Z', '2025-03-25T12:30:00.000Z'), ('2025-03-25T07:17:19.329Z', '2025-03-25T12:32:27.063Z')), # Edit
    (('2025-03-26T07:30:00.000Z', '2025-03-26T09:30:00.000Z'), ('2025-03-26T07:24:15.776Z', '2025-03-26T09:31:20.722Z')),
    (('2025-03-27T10:30:00.000Z', '2025-03-27T12:00:00.000Z'), ('2025-03-27T10:33:21.776Z', '2025-03-27T12:02:54.700Z')), # OT only
    (('2025-03-30T09:45:00.000Z', '2025-03-30T11:00:00.000Z'), ('2025-03-30T09:43:41.389Z', '2025-03-30T10:55:50.985Z'))
]

ot_reasons = [
    "Urgent shipment processing for next-day delivery",
    "System maintenance and inventory reconciliation",
    "Peak season order backlog clearance",
    "Last-minute large customer order fulfillment",
    "Covering for absent team member",
    "End-of-month inventory count and reporting",
    "Special handling required for temperature-sensitive cargo",
    "Warehouse reorganization for efficiency improvement",
    "Loading delay due to supplier late delivery",
    "Emergency order processing for medical supplies",
    "Cross-dock operation for time-sensitive deliveries",
    "System upgrade support and data migration",
    "High volume of returns processing",
    "Container unloading backlog clearance"
]







correct_ot = [
    (('2025-03-01T08:15:00.000Z', '2025-03-01T10:45:00.000Z'), ('2025-03-01T08:16:50.920Z', '2025-03-01T10:48:56.957Z')), # Edit - timestamp out to "2025-03-01T10:45:00.000Z" then shift reason to "Urgent shipment processing for today" 
    (('2025-03-25T07:15:00.000Z', '2025-03-25T12:30:00.000Z'), ('2025-03-25T07:17:19.329Z', '2025-03-25T12:32:27.063Z')) # Edit - both img in and out
]

correct_regular = [
    (('2025-03-19T02:45:00.000Z', '2025-03-19T08:45:00.000Z'), ('2025-03-19T02:46:01.758Z', '2025-03-19T08:45:42.468Z')), # Edit - timestamp in to '2025-03-19T02:45:00.000Z'
    (('2025-03-23T02:15:00.000Z', '2025-03-23T07:45:00.000Z'), ('2025-03-23T01:55:53.960Z', '2025-03-23T07:44:25.407Z')), # Edit - shift reason to "Managing cargo"
    (('2025-03-30T23:15:00.000Z', '2025-03-31T06:30:00.000Z'), ('2025-03-30T23:14:27.044Z', '2025-03-31T06:33:35.564Z')) # Edit - timestamp out to "2025-03-31T06:30:00.000Z"
]






class TimeRecordAPI:
    def __init__(self, base_url: str = "http://localhost:3000/api"):
        self.base_url = base_url
        self.clock_in_url = f"{base_url}/time-record-2/clock-in"
        self.clock_out_url = f"{base_url}/time-record-2/clock-out"
        self.auth_url = f"{base_url}/dev-session/user_2riGJ090dbQNR41ccdBjkzvA3f6"
        self.session = requests.Session()
        self._setup_auth()
        
    def _setup_auth(self):
        """
        Setup authentication by visiting the auth endpoint and capturing the cookie
        """
        try:
            # Visit the auth endpoint - this will set the cookie automatically
            response = self.session.get(self.auth_url)
            if response.status_code != 200:
                raise Exception(f"Failed to authenticate. Status code: {response.status_code}")
            
            # Debug: Print cookies to verify
            print("Cookies after auth:", self.session.cookies.get_dict())
            
        except Exception as e:
            raise Exception(f"Authentication failed: {str(e)}")

    def clock_in(self, 
                shift_type: str,
                shift_time: str,
                lat: float,
                lon: float,
                reason: Optional[str] = None) -> str:
        """
        Send clock-in request to the API
        Returns: document_id on success, raises Exception on failure
        """
        payload = {
            "shift_type": shift_type,
            "shift_time": shift_time,
            "image_url": "https://storage.example.com/clock-in-sample.jpg",
            "lat": lat,
            "lon": lon
        }
        
        if reason:
            payload["reason"] = reason

        # Debug: Print request details
        print(f"\nMaking clock-in request to {self.clock_in_url}")
        print("Cookies being sent:", self.session.cookies.get_dict())
        print("Payload:", payload)

        response = self.session.post(
            self.clock_in_url, 
            json=payload,
            headers={"Content-Type": "application/json"}
        )

        # Debug: Print response details
        print(f"Response status code: {response.status_code}")
        print(f"Response body: {response.text}")

        if response.status_code != 200:
            raise Exception(f"Clock-in failed with status {response.status_code}: {response.text}")

        data = response.json()
        if data["status"] == "success":
            return data["data"]["document_id"]
        else:
            raise Exception(f"Clock-in failed: {data.get('message', 'Unknown error')}")

    def clock_out(self,
                 doc_id: str,
                 shift_time: str,
                 lat: float,
                 lon: float) -> str:
        """
        Send clock-out request to the API
        Returns: document_id on success, raises Exception on failure
        """
        payload = {
            "doc_id": doc_id,
            "shift_time": shift_time,
            "image_url": "https://storage.example.com/clock-out-sample.jpg",
            "lat": lat,
            "lon": lon
        }

        # Debug: Print request details
        print(f"\nMaking clock-out request to {self.clock_out_url}")
        print("Cookies being sent:", self.session.cookies.get_dict())
        print("Payload:", payload)

        response = self.session.post(
            self.clock_out_url, 
            json=payload,
            headers={"Content-Type": "application/json"}
        )

        # Debug: Print response details
        print(f"Response status code: {response.status_code}")
        print(f"Response body: {response.text}")

        if response.status_code != 200:
            raise Exception(f"Clock-out failed with status {response.status_code}: {response.text}")

        data = response.json()
        if data["status"] == "success":
            return data["data"]["doc_id"]
        else:
            raise Exception(f"Clock-out failed: {data.get('message', 'Unknown error')}")

def process_time_records(
    location_pairs: List[Tuple[Tuple[float, float], Tuple[float, float]]],
    shift_reasons: List[str],
    shifts: List[Tuple[Tuple[str, str], Tuple[str, str]]],
    shift_type: str
) -> List[Tuple[str, str, str]]:
    """
    Process time records for multiple shifts and return modified timestamps
    """
    api = TimeRecordAPI()
    edit_regular_timestamp = []

    for (locations, reason, shift) in zip(location_pairs, shift_reasons, shifts):
        (clock_in_loc, clock_out_loc) = locations
        ((planned_in, planned_out), (actual_in, actual_out)) = shift
        
        try:
            # Clock in
            doc_id = api.clock_in(
                shift_type=shift_type,
                shift_time=planned_in,
                lat=clock_in_loc[0],
                lon=clock_in_loc[1],
                reason=reason
            )

            # Clock out
            api.clock_out(
                doc_id=doc_id,
                shift_time=planned_out,
                lat=clock_out_loc[0],
                lon=clock_out_loc[1]
            )

            # Store the result with doc_id
            edit_regular_timestamp.append((doc_id, actual_in, actual_out))
            
        except Exception as e:
            print(f"Error processing shift: {e}")
            continue

    return edit_regular_timestamp


def update_shift_timestamps(timestamp_updates: List[Tuple[str, str, str]]):
    """
    Update start_time.timestamp and end_time.timestamp for documents in the time_record index.
    
    Args:
        timestamp_updates: List of tuples containing (document_id, start_timestamp, end_timestamp)
                         Timestamps should be in ISO format with milliseconds (e.g., "2025-02-01T08:00:00.123Z")
    """
    # Initialize Elasticsearch client
    es = Elasticsearch(["http://localhost:9200"])
    
    # Process each update
    for doc_id, start_timestamp, end_timestamp in timestamp_updates:
        try:
            # Prepare the update body
            update_body = {
                "doc": {
                    "start_time": {
                        "timestamp": start_timestamp
                    },
                    "end_time": {
                        "timestamp": end_timestamp
                    }
                }
            }
            
            # Perform the update
            response = es.update(
                index="time_record",
                id=doc_id,
                body=update_body
            )
            
            # Check if update was successful
            if response['result'] == 'updated':
                print(f"Successfully updated document {doc_id}")
            else:
                print(f"Update failed for document {doc_id}: {response}")
                
        except Exception as e:
            print(f"Error updating document {doc_id}: {str(e)}")
    
    # Close the connection
    es.close()



results_regular = process_time_records(
    location_pairs=regular_location,
    shift_reasons=regular_reasons,
    shifts=regular_shifts,
    shift_type='on-site'
)

results_ot = process_time_records(
    location_pairs=ot_location,
    shift_reasons=ot_reasons,
    shifts=ot_shifts,
    shift_type='overtime'
)

update_shift_timestamps(results_regular)
update_shift_timestamps(results_ot)