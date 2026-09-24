# SIH 26124 — Requirements Coverage Map

**Project:** UrbanPulse — AI-Powered Mobile Urban Intelligence Platform
**Team:** Signal Sync
**Org:** Bharat Electronics Limited
**Category:** Software
**Theme:** Smart Automation

**Repo:** https://github.com/Signal-Sync/UrbanPulse-
**Prototype Status:** Working prototype (~85% PS coverage)
**TRL:** 4 (lab-validated on real video, CPU-only edge)

---

## A. Onboard Edge AI Processing

| # | PS Requirement | Status | Implementation | Evidence |
|---|---|---|---|---|
| A1a | Potholes | ✅ Working | Donor model `best.pt` (YOLOv8n) | Live detections |
| A1b | Damaged roads | ✅ Working | `unpaved_road` class | Live detections |
| A1c | Other road hazards | ✅ Working | `speed_bump` class | Live detections |
| A1d | Waterlogging | ⚠️ Roadmap | Rule-based HSV heuristic designed | — |
| A1e | Missing zebra crossings | ⚠️ Roadmap | Absence heuristic designed | — |
| A1f | Missing road dividers | ⚠️ Roadmap | Requires lane-seg model | — |
| A1g | Damaged traffic signboards | ⚠️ Roadmap | Requires dedicated classifier | — |
| A2 | Vehicle detection + classification + counting | ✅ Working | YOLOv8n COCO — car, bus, truck, motorcycle, person | Live traffic panel |
| A3 | Traffic bottleneck | ✅ Working | Count-based heuristic in `runtime.py` | MEDIUM/HIGH congestion events |
| A4 | Vulnerable pedestrian (school zone) | ⚠️ Backend only | `SCHOOL_ZONE_PEDESTRIAN` event type | 814 schools loaded |
| A5 | Hit-and-run + ANPR + plate extraction | ⚠️ Endpoint only | `/api/incidents/anpr` + 3 demo events | Returns `{incidents: [...], count: 3}` |
| A6 | Edge processing (bandwidth minimization) | ✅ Working | 320 px downscale, frame-skip, JSON-only sync | See C3 |
| A7 | Multi-camera fusion | ✅ 2 cameras | Road (forward) + Traffic (side) concurrent | `/api/status` |

## B. Centralized Intelligence Platform

| # | PS Requirement | Status | Implementation |
|---|---|---|---|
| B1 | Fleet-wide event aggregation | ✅ Working | FastAPI + SQLite, real-time ingest |
| B2 | GIS map visualization | ✅ Working | React + Leaflet, 5 tile providers |
| B3 | Congestion heat map | ✅ Working | Density heat map in GISMap.jsx |
| B4 | Infrastructure deficiency map | ✅ Working | Density circles by defect type |
| B5 | O-D matrix | ❌ Roadmap | Requires trip inference |
| B6 | Route delay estimation | ❌ Roadmap | Requires schedule data |
| B7 | Actionable insights / reports | ⚠️ Partial | Incident workflow: DETECTED → VERIFIED → ASSIGNED → RESOLVED → CLOSED |
| B8 | Secure alert sharing | ⚠️ Partial | REST endpoints exposed, auth token pending |

## C. Cross-Cutting Requirements

| # | PS Requirement | Status | Implementation |
|---|---|---|---|
| C1 | Edge optimization | ✅ | 320 px, frame-skip, YOLOv8n (nano) |
| C2 | Confidence scoring + FP reduction | ✅ | Confidence threshold + spatial dedup + temporal cooldown |
| C3 | Bandwidth minimization proof | ✅ | `/api/metrics/bandwidth` — **148,000× reduction** |
| C4 | Evidence / audit trail | ✅ | JPEG crop + status_history JSON per event |
| C5 | Public safety | ⚠️ Backend only | School-zone event emits, UI surfacing pending |

---

## D. Verified Metrics

| Metric | Value |
|---|---|
| Events captured | 500+ live |
| Edge inference latency | ~100 ms/frame (CPU-only) |
| Edge FPS | 3–6 (Intel i3-10110U) |
| Bandwidth reduction | **148,000×** |
| Raw video counterfactual | 201.6 GB/bus/day |
| Actual edge upload | ~1.2 MB/bus/day |

---

## E. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Edge AI | Ultralytics YOLOv8n | Road + vehicle detection |
| Edge processing | OpenCV | Video decode, resize, annotation |
| Tracking | ByteTrack (Ultralytics) | Vehicle IDs |
| Backend | FastAPI + Uvicorn | Async REST + MJPEG streaming |
| Storage | SQLite + WAL | Events DB |
| Frontend | React 18 + Vite + Tailwind | Dashboard |
| GIS | Leaflet | 5 tile providers |

---

## F. Known Limitations & Roadmap

| Gap | Timeline |
|---|---|
| Waterlogging detection | 2 weeks (retrain + labeled data) |
| Missing zebra / divider / signboard | 3 weeks |
| Real ANPR plate OCR | 1 week (PaddleOCR integration) |
| PostgreSQL + PostGIS migration | 1 week |
| Jetson Orin Nano deployment | 3 days |
| O-D matrix, route delay | 4 weeks |

---

## G. Demo Evidence

- **Live demo**: 2 cameras running, real-time inference, live event stream
- **Bandwidth proof**: `/api/metrics/bandwidth`
- **ANPR demo events**: 3 seeded, viewable in Incident Center
- **Repo**: https://github.com/Signal-Sync/UrbanPulse-

---

**Team Signal Sync** — SIH 2026
