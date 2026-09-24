import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { CHENNAI_FLEET } from '../data/busesData';
import { INITIAL_ALL_DETECTIONS } from '../data/detectionsData';
import { DEPARTMENTS } from '../data/departmentsData';
import { updateBusCoordinate } from '../utils/geoUtils';
import { getAutoAssignedDepartment, generateReportId } from '../utils/workflowEngine';

import { CENTRAL_URL, EDGE_URL, readJson, eventToDetection } from '../services/edgeApi';

const UrbanPulseContext = createContext(null);

// Calculate approximate distance between two GPS coordinates in meters
function distanceInMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;

  const toRadians = degrees => degrees * Math.PI / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
    Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) ** 2;

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function UrbanPulseProvider({ children }) {
  const [buses, setBuses] = useState(CHENNAI_FLEET);
  const [detections, setDetections] = useState(
    INITIAL_ALL_DETECTIONS.map(d => ({ ...d, title: `[SAMPLE] ${d.title}`, detectionSource: 'SEEDED_DEMO' }))
  );
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [simulationRunning, setSimulationRunning] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [selectedBus, setSelectedBus] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Real-time notification queue
  const [notifications, setNotifications] = useState([
    {
      id: 'notif-1',
      title: '[SAMPLE] Hit-and-Run Incident Alert',
      message: 'Bus-104 detected vehicle collision on OMR Sholinganallur. ANPR identified TN-09-CB-4491.',
      category: 'CRITICAL',
      time: 'Just now',
      timestamp: Date.now(),
      unread: true,
      reportId: 'INC-901'
    },
    {
      id: 'notif-2',
      title: '[SAMPLE] Critical Pothole Detected',
      message: 'Bus-118 identified 18cm deep crater at Guindy Kathipara underpass.',
      category: 'WARNING',
      time: '9 min ago',
      timestamp: Date.now() - 9 * 60000,
      unread: true,
      reportId: 'PH-1043'
    },
    {
      id: 'notif-3',
      title: '[SAMPLE] School Zone Speed Violation',
      message: 'Bus-205 recorded vehicle speeding at 58 km/h outside DAV Public School.',
      category: 'WARNING',
      time: '8 min ago',
      timestamp: Date.now() - 8 * 60000,
      unread: true,
      reportId: 'SZV-701'
    },
    {
      id: 'notif-4',
      title: '[SAMPLE] Waterlogging Inundation Alert',
      message: 'Perungudi Toll plaza left lanes submerged (22cm depth). GCC SWD dispatched.',
      category: 'CRITICAL',
      time: '4 min ago',
      timestamp: Date.now() - 4 * 60000,
      unread: true,
      reportId: 'WL-3012'
    },
    {
      id: 'notif-5',
      title: '[SAMPLE] Department Action Resolved',
      message: 'Anna Salai Nandanam trench repair completed by GCC Rapid Squad.',
      category: 'INFO',
      time: '25 min ago',
      timestamp: Date.now() - 25 * 60000,
      unread: false,
      reportId: 'PH-1046'
    }
  ]);

  const [centralConnection, setCentralConnection] = useState('connecting');

  // ──────────────────────────────────────────────────────────────
  // IMPORTANT: cursor and seen-set are IN-MEMORY ONLY.
  // Previously persisted to localStorage, which caused every page
  // reload to skip previously-seen events and show an empty map.
  // On reload we now refetch from cursor 0 — the central backend
  // dedups the events, and we dedup on the client by event_id.
  // ──────────────────────────────────────────────────────────────
  const eventCursor = useRef(0);
  const seenEdgeEvents = useRef(new Set());

  useEffect(() => {
    let cancelled = false, timer;

    // Throttle: remember last time we created notifications from a poll cycle
    let lastNotifTime = 0;
    const NOTIF_COOLDOWN_MS = 5000;   // at most one batch of notif per 5s
    const MAX_NOTIFS_PER_CYCLE = 3;    // at most 3 notifications per poll

    async function pollEvents() {
      try {
        const page = await readJson(
          `${CENTRAL_URL}/api/events?after=${eventCursor.current}&limit=200`
        );
        if (cancelled) return;

        const events = Array.isArray(page.events) ? page.events : [];
        const fresh = events.filter((e) => !seenEdgeEvents.current.has(e.event_id));
        fresh.forEach((e) => seenEdgeEvents.current.add(e.event_id));
        if (typeof page.next_cursor === 'number') {
          eventCursor.current = page.next_cursor;
        } else {
          eventCursor.current += events.length;
        }

        if (fresh.length) {
          const records = fresh.map(eventToDetection).reverse();
          setDetections((prev) => {
            const known = new Set(prev.map((d) => d.id));
            const newRecords = records.filter((d) => !known.has(d.id));
            return newRecords.length ? [...newRecords, ...prev] : prev;
          });

          // Only push notifications under strict conditions
          const now = Date.now();
          const cooldownOk = now - lastNotifTime >= NOTIF_COOLDOWN_MS;
          if (cooldownOk) {
            lastNotifTime = now;
            const notifsToAdd = records.slice(0, MAX_NOTIFS_PER_CYCLE).map((d) => ({
              id: `edge-${d.id}`,
              reportId: d.id,
              title: d.title,
              message:
                `${d.busId} / ${d.cameraId} · ${d.timestamp} · ${d.location}` +
                (d.vehicleCount != null ? ` · Vehicles: ${d.vehicleCount}` : '') +
                (d.trackId != null ? ` · Track #${d.trackId}` : ''),
              category: d.severity === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
              time: new Date(d.timestamp).toLocaleTimeString(),
              timestamp: Date.parse(d.timestamp),
              unread: true,
            }));
            setNotifications((prev) => [...notifsToAdd, ...prev].slice(0, 15));
          }
        }

        setCentralConnection('connected');
        if (!cancelled) {
          timer = setTimeout(
            pollEvents,
            events.length === 200 ? 200 : 3000
          );
        }
      } catch {
        if (!cancelled) {
          setCentralConnection('offline');
          timer = setTimeout(pollEvents, 5000);
        }
      }
    }

    pollEvents();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // ──────────────────────────────────────────────────────────────
  // Derived category lists
  // NOTE: school_zone_pedestrian added — runtime.py emits this event
  // when a bus passes a school zone and detects pedestrians.
  // ──────────────────────────────────────────────────────────────
  const potholes = detections.filter(d =>
  ['pothole', 'road_damage', 'road_crack', 'road_patch', 'road_other'].includes(d.type)
);
  const waterlogging = detections.filter(d => d.type === 'waterlogging');
  const trafficSignals = detections.filter(d =>
    d.type === 'damaged_signal' ||
    d.type === 'damaged_signboard' ||
    d.type === 'missing_zebra_crossing'
  );
  const schoolViolations = detections.filter(d =>
    d.type === 'school_zone_violation' || d.type === 'school_zone_pedestrian'
  );
  const incidents = detections.filter(d =>
    [
      'hit_and_run', 'rash_driving', 'dangerous_overtaking', 'pedestrian_risk',
      'traffic_congestion', 'school_zone_pedestrian',
      'red_light_violation', 'wrong_way_driving'
    ].includes(d.type)
  );

  // Live simulation tick every 6 seconds
  useEffect(() => {
    if (!simulationRunning) return;

    const interval = setInterval(() => {
      setBuses(prevBuses =>
        prevBuses.map(bus => {
          const newCoords = updateBusCoordinate(bus.lat, bus.lng, bus.heading, bus.speed);
          const jitterSpeed = Math.max(10, Math.min(55, bus.speed + Math.floor(Math.random() * 5 - 2)));
          return {
            ...bus,
            lat: newCoords.lat,
            lng: newCoords.lng,
            speed: jitterSpeed,
            lastUpdate: 'Just now'
          };
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [simulationRunning]);
  // ── Live GPS from edge /api/status ─────────────────────
  // Marks BUS-104 (whichever bus the edge reports) with edgeGps: true
  // and updates its lat/lng from the real edge GPS fix.
  useEffect(() => {
    let cancelled = false, timer;
    async function pollGPS() {
      try {
        const status = await readJson(`${EDGE_URL}/api/status`);
        if (cancelled) return;
        if (status.gps?.valid) {
          const fix = status.gps;
          setBuses(prev =>
            prev.map(bus =>
              bus.id === status.bus_id
                ? {
                    ...bus,
                    lat: fix.latitude,
                    lng: fix.longitude,
                    edgeGps: true,
                    gpsSource: fix.source,
                    gpsStale: false,
                    currentLocation:
                      fix.source === 'SIMULATED_ROUTE'
                        ? 'Prototype GPS route'
                        : 'External GPS fix',
                  }
                : bus
            )
          );
        }
      } catch {
        /* edge offline — leave edgeGps unset for all */
      }
      if (!cancelled) timer = setTimeout(pollGPS, 2000);
    }
    pollGPS();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  // Add a new detection from Live Camera / Edge AI
  const addNewDetection = (customData = {}) => {
    const type = customData.type || 'pothole';
    const deptInfo = getAutoAssignedDepartment(type);

    const selectedBus = customData.busId ? buses.find(bus => bus.id === customData.busId) : null;
    const randomBus = selectedBus || buses[Math.floor(Math.random() * buses.length)];

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toISOString().split('T')[0];

    const confidence = typeof customData.confidence === 'number' ? customData.confidence : 0.92;
    const severity = customData.severity || (confidence >= 0.90 ? 'CRITICAL' : 'HIGH');
    const lat = customData.lat ?? randomBus?.lat ?? 12.9016;
    const lng = customData.lng ?? randomBus?.lng ?? 80.2279;

    const existingIncident = detections.find(item => {
      if (item.type !== type) return false;
      const source = item.detectionSource || '';
      const isLiveAiIncident =
        source === 'LIVE_AI' || source === 'UPLOADED_VIDEO_AI' || source === 'WEBCAM_AI';
      if (!isLiveAiIncident) return false;
      if (typeof item.lat !== 'number' || typeof item.lng !== 'number') return false;
      return distanceInMeters(lat, lng, item.lat, item.lng) <= 50;
    });

    if (existingIncident) {
      const observation = {
        id: `obs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        busId: customData.busId || randomBus?.id || 'UNKNOWN-BUS',
        cameraId: customData.cameraId || 'FRONT-CAM-01',
        confidence,
        detectionSource: customData.detectionSource || 'LIVE_AI',
        evidenceImg: customData.evidenceImg || null,
        boundingBox: customData.boundingBox || null,
        detectedAt: customData.detectedAt || now.toISOString(),
        timestamp: `${dateStr} ${timeStr}`
      };

      let updatedIncident = null;
      setDetections(prev =>
        prev.map(item => {
          if (item.id !== existingIncident.id) return item;
          const observations = [...(item.observations || []), observation];
          const highestConfidence = Math.max(item.confidence || 0, confidence);
          updatedIncident = {
            ...item,
            id: item.id,
            observationCount: observations.length,
            observations,
            confidence: highestConfidence,
            lastDetectedAt: customData.detectedAt || now.toISOString(),
            lastDetectedBy: customData.busId || randomBus?.id || 'UNKNOWN-BUS',
            evidenceImg: customData.evidenceImg || item.evidenceImg,
            severity: item.severity === 'CRITICAL' || severity === 'CRITICAL' ? 'CRITICAL' : item.severity,
            statusHistory: [
              ...(item.statusHistory || []),
              {
                status: item.status,
                time: `${dateStr} ${timeStr}`,
                note: `Additional AI observation received from ${customData.busId || randomBus?.id || 'road camera'}`
              }
            ]
          };
          return updatedIncident;
        })
      );
      return updatedIncident || existingIncident;
    }

    const newId = customData.id || generateReportId(type);
    const newDetection = {
      id: newId,
      type,
      title: customData.title || `Live AI Detected: ${type.replace(/_/g, ' ').toUpperCase()}`,
      location: customData.location || randomBus?.currentLocation || 'Live Road Monitoring',
      area: customData.area || 'OMR Corridor',
      lat, lng, severity, confidence,
      detectionSource: customData.detectionSource || 'LIVE_AI',
      boundingBox: customData.boundingBox || null,
      detectedAt: customData.detectedAt || now.toISOString(),
      lastDetectedAt: customData.detectedAt || now.toISOString(),
      busId: customData.busId || randomBus?.id || 'UNKNOWN-BUS',
      cameraId: customData.cameraId || 'FRONT-CAM-01',
      timestamp: customData.timestamp || `${dateStr} ${timeStr}`,
      timeAgo: 'Just now',
      department: customData.department || deptInfo.department,
      division: customData.division || deptInfo.division,
      deptId: customData.deptId || deptInfo.deptId,
      assignedOfficer: customData.assignedOfficer || deptInfo.officer,
      status: customData.status || 'DETECTED',
      statusHistory: [
        {
          status: 'DETECTED',
          time: `${dateStr} ${timeStr}`,
          note: customData.detectionSource === 'LIVE_AI'
            ? `YOLO AI detected ${type.replace(/_/g, ' ')} from live camera`
            : 'AI Edge inference tagged live detection'
        }
      ],
      observationCount: 1,
      observations: [
        {
          id: `obs-${Date.now()}`,
          busId: customData.busId || randomBus?.id || 'UNKNOWN-BUS',
          cameraId: customData.cameraId || 'FRONT-CAM-01',
          confidence,
          detectionSource: customData.detectionSource || 'LIVE_AI',
          evidenceImg: customData.evidenceImg || null,
          boundingBox: customData.boundingBox || null,
          detectedAt: customData.detectedAt || now.toISOString(),
          timestamp: `${dateStr} ${timeStr}`
        }
      ],
      evidenceImg: customData.evidenceImg || null,
      evidenceCaptured: Boolean(customData.evidenceImg),
      ...customData
    };

    setDetections(prev => [newDetection, ...prev]);

    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: `LIVE AI: ${type.replace(/_/g, ' ').toUpperCase()} DETECTED`,
      message:
        `${newDetection.busId} / ${newDetection.cameraId} detected ` +
        `${type.replace(/_/g, ' ')} with ` +
        `${Math.round(confidence * 100)}% confidence. ` +
        `Incident ${newId} created and assigned to ${newDetection.department}.`,
      category: severity === 'CRITICAL' || severity === 'EMERGENCY' ? 'CRITICAL' : 'WARNING',
      time: 'Just now',
      timestamp: Date.now(),
      unread: true,
      reportId: newId,
      type,
      busId: newDetection.busId,
      lat: newDetection.lat,
      lng: newDetection.lng
    };

    if (typeof window !== 'undefined') {
      window.__UP_NOTIF_LAST = window.__UP_NOTIF_LAST || 0;
      const __t = Date.now();
      if (__t - window.__UP_NOTIF_LAST >= 5000) {
        window.__UP_NOTIF_LAST = __t;
        setNotifications(prev => [newNotif, ...prev].slice(0, 15));
      }
    }

    return newDetection;
  };

  // STRICT INCIDENT WORKFLOW
  const WORKFLOW_TRANSITIONS = {
    DETECTED: 'VERIFIED',
    VERIFIED: 'ASSIGNED',
    ASSIGNED: 'IN PROGRESS',
    'IN PROGRESS': 'RESOLVED',
    RESOLVED: 'VERIFIED CLOSED'
  };

  const updateReportStatus = async (reportId, newStatus, note = '', assignedDept = null) => {
    const edgeRecord = detections.find(d => d.id === reportId && d.edgeEvent);
    if (edgeRecord) {
      try {
        const event = await readJson(`${CENTRAL_URL}/api/events/${reportId}/status`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus, note, department: assignedDept }),
        });
        const updated = eventToDetection(event);
        setDetections(prev => prev.map(d => d.id === reportId ? updated : d));
        setSelectedReport(prev => prev?.id === reportId ? updated : prev);
        return true;
      } catch (error) {
        window.alert(`Status was not saved: ${error.message}`);
        return false;
      }
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toISOString().split('T')[0];

    let transitionAccepted = false;
    let updatedIncident = null;

    setDetections(prev =>
      prev.map(item => {
        if (item.id !== reportId) return item;

        const currentStatus = item.status || 'DETECTED';
        const expectedNextStatus = WORKFLOW_TRANSITIONS[currentStatus];

        if (newStatus !== expectedNextStatus) {
          console.warn(`Invalid workflow transition: ${currentStatus} → ${newStatus}`);
          return item;
        }

        transitionAccepted = true;
        const updatedHistory = [
          ...(item.statusHistory || []),
          {
            status: newStatus,
            time: `${dateStr} ${timeStr}`,
            note: note || `Incident moved from ${currentStatus} to ${newStatus}`
          }
        ];

        updatedIncident = { ...item, status: newStatus, statusHistory: updatedHistory };

        if (assignedDept) {
          updatedIncident.department = assignedDept.department || item.department;
          updatedIncident.division = assignedDept.division || item.division;
          updatedIncident.deptId = assignedDept.deptId || item.deptId;
        }

        if (newStatus === 'RESOLVED') {
          updatedIncident.resolutionDate = `${dateStr} ${timeStr}`;
          updatedIncident.resolvedBy = item.department || 'Field Action Team';
          updatedIncident.resolutionNote = note || 'Issue rectified by field team.';
        }

        if (newStatus === 'VERIFIED CLOSED') {
          updatedIncident.closedDate = `${dateStr} ${timeStr}`;
          updatedIncident.closedBy = item.department || 'Verification Team';
          updatedIncident.closureNote = note || 'Subsequent road observation verified that the issue has been resolved.';
          updatedIncident.resolutionDate = item.resolutionDate || `${dateStr} ${timeStr}`;
          updatedIncident.resolutionNote = item.resolutionNote || 'Issue rectified and verified.';
        }

        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport(updatedIncident);
        }

        return updatedIncident;
      })
    );

    return transitionAccepted;
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  };

  const unreadNotifCount = notifications.filter(n => n.unread).length;

  // ──────────────────────────────────────────────────────────────
  // DEV HELPER: force-refresh from the central backend.
  // Call `window.__UP_RESET_EVENTS()` in the browser console to
  // clear local dedup and refetch everything from cursor 0.
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__UP_RESET_EVENTS = () => {
        eventCursor.current = 0;
        seenEdgeEvents.current.clear();
        localStorage.removeItem('up_event_cursor');
        localStorage.removeItem('up_seen_events');
        setDetections(INITIAL_ALL_DETECTIONS.map(d => ({
          ...d, title: `[SAMPLE] ${d.title}`, detectionSource: 'SEEDED_DEMO'
        })));
        console.info('[UrbanPulse] Events reset. Next poll will refetch from cursor 0.');
      };
    }
    return () => {
      if (typeof window !== 'undefined') delete window.__UP_RESET_EVENTS;
    };
  }, []);

  return (
    <UrbanPulseContext.Provider
      value={{
        centralConnection,
        buses,
        detections,
        potholes,
        waterlogging,
        trafficSignals,
        schoolViolations,
        incidents,
        departments,
        notifications,
        unreadNotifCount,
        simulationRunning,
        setSimulationRunning,
        selectedReport,
        setSelectedReport,
        selectedBus,
        setSelectedBus,
        isSearchOpen,
        setIsSearchOpen,
        isNotificationOpen,
        setIsNotificationOpen,
        activeRoute,
        setActiveRoute,
        activeFilter,
        setActiveFilter,
        addNewDetection,
        updateReportStatus,
        markAllNotificationsRead
      }}
    >
      {children}
    </UrbanPulseContext.Provider>
  );
}

export function useUrbanPulse() {
  const context = useContext(UrbanPulseContext);
  if (!context) {
    throw new Error('useUrbanPulse must be used within an UrbanPulseProvider');
  }
  return context;
}
