import React from 'react';
import {
  Bus,
  Activity,
  AlertTriangle,
  Cone,
  Building2,
  Cpu,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle2,
} from 'lucide-react';
import { StatCard } from '../components/common/StatCard';
import { GISMap } from '../components/map/GISMap';
import { MapFilterBar } from '../components/map/MapFilterBar';
import { LiveDetectionStream } from '../components/dashboard/LiveDetectionStream';
import { useUrbanPulse } from '../context/UrbanPulseContext';
import { exportToCSV } from '../utils/exportUtils';
import { DEPARTMENTS } from '../data/departmentsData';

export function DashboardPage() {
  const { buses, detections, potholes, setActiveRoute } = useUrbanPulse();

  const liveBuses = buses.filter(b => b.edgeGps).length;
  const criticalAlerts = detections.filter(d => d.severity === 'CRITICAL').length;
  const congestionEvents = detections.filter(d => d.type === 'traffic_congestion').length;
  const resolvedCount = detections.filter(
    d => d.status === 'RESOLVED' || d.status === 'VERIFIED CLOSED'
  ).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Dashboard Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
              City Intelligence Overview
            </h1>
            <span className="text-[9px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">
              SIH 26124 · BEL
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Live edge AI on 1 prototype bus · Architecture scales to 1,000-bus MTC fleet
          </p>
          <div className="flex items-center gap-2 mt-2 text-[10px] font-bold">
            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">● SENSE</span>
            <span className="text-slate-300">→</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">● DETECT</span>
            <span className="text-slate-300">→</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">● VALIDATE</span>
            <span className="text-slate-300">→</span>
            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">● ACT</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => exportToCSV(detections, 'urbanpulse-city-detections.csv')}
            className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 shadow-subtle transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
            <span>EXPORT CSV</span>
          </button>

          <button
            onClick={() => setActiveRoute('live-camera')}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-xs flex items-center gap-2"
          >
            <Activity className="w-3.5 h-3.5" />
            <span>CONNECT LIVE CAMERA</span>
          </button>
        </div>
      </div>

      {/* Live KPI Cards — all values computed from real data */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          title="LIVE BUSES"
          value={liveBuses}
          subtitle="1 live · 999 projected"
          variant="default"
          icon={Bus}
          onClick={() => setActiveRoute('fleet')}
        />
        <StatCard
          title="ACTIVE DETECTIONS"
          value={detections.length}
          subtitle="from edge AI"
          variant="default"
          icon={Activity}
          onClick={() => setActiveRoute('all-logs')}
        />
        <StatCard
          title="CRITICAL ALERTS"
          value={criticalAlerts}
          subtitle={criticalAlerts > 0 ? 'requires attention' : 'all clear'}
          variant={criticalAlerts > 0 ? 'danger' : 'success'}
          icon={AlertTriangle}
          onClick={() => setActiveRoute('incident-center')}
        />
        <StatCard
          title="ROAD DEFECTS"
          value={potholes.length}
          subtitle="crack · pothole · patch"
          variant="warning"
          icon={Cone}
          onClick={() => setActiveRoute('potholes')}
        />
        <StatCard
          title="CONGESTION"
          value={congestionEvents}
          subtitle="live zones"
          variant={congestionEvents > 0 ? 'warning' : 'success'}
          icon={TrendingUp}
          onClick={() => setActiveRoute('traffic-intel')}
        />
        <StatCard
          title="RESOLVED"
          value={resolvedCount}
          subtitle="closed tickets"
          variant="success"
          icon={CheckCircle2}
          onClick={() => setActiveRoute('department-response')}
        />
      </div>

      {/* Map & Live Stream Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span>Live City GIS Map</span>
              <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                CHENNAI METROPOLITAN AREA
              </span>
            </h3>
            <button
              onClick={() => setActiveRoute('live-city')}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              Full Screen Map <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <MapFilterBar />
          <GISMap height="510px" />
        </div>

        <div className="lg:col-span-1">
          <LiveDetectionStream />
        </div>
      </div>

      {/* Department SLA & Edge AI Banner Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded-card border border-slate-200 p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-900">
                    Department Assignment & SLA
                  </h3>
                  <span className="text-[9px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                    SAMPLE DATA
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Autonomous defect routing to responsible civic bodies (sample until live departments connect)
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveRoute('department-response')}
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              Manage Tasks <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {DEPARTMENTS.slice(0, 4).map(dept => (
              <div
                key={dept.id}
                onClick={() => setActiveRoute('department-response')}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 hover:shadow-subtle cursor-pointer transition-all space-y-1.5"
              >
                <span className="text-[10px] font-bold text-slate-500 uppercase block truncate">
                  {dept.shortName}
                </span>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-extrabold text-slate-900">
                    {dept.openTickets}
                  </span>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                    open
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Avg SLA: <strong className="text-slate-700">{dept.avgResponseHours}h</strong>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white text-slate-800 rounded-card border border-slate-200 p-5 shadow-subtle flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <Cpu className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wider">
                    Edge AI Network
                  </h3>
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    YOLOv8n · CPU inference
                  </p>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded">
                ● LIVE
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-3 font-mono">
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">BANDWIDTH SAVED</span>
                <span className="text-base font-bold text-blue-600">148,988×</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">AVG LATENCY</span>
                <span className="text-base font-bold text-slate-900">~100 ms</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveRoute('edge-network')}
            className="w-full py-2 px-3 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Inspect Edge Architecture</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
