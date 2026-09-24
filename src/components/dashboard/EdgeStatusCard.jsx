import React, { useEffect, useState } from 'react';
import { Radio, MapPin, Video, Car, AlertCircle } from 'lucide-react';
import { EDGE_URL, readJson } from '../../services/edgeApi';

export function EdgeStatusCard() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await readJson(`${EDGE_URL}/api/status`);
        if (!cancelled) {
          setStatus(data);
          setError(null);
          setLastUpdate(Date.now());
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };

    load();
    const id = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <div>
          <div className="text-xs font-bold text-red-900 uppercase tracking-wider">
            Edge AI Offline
          </div>
          <div className="text-[11px] text-red-700">{error}</div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 animate-pulse">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Connecting to edge AI…
        </div>
      </div>
    );
  }

  const bus = status.bus_id || 'UNKNOWN';
  const gps = status.gps || {};
  const road = status.cameras?.road || {};
  const traffic = status.cameras?.traffic || {};
  const secsAgo = lastUpdate ? Math.round((Date.now() - lastUpdate) / 1000) : '?';

  return (
    <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
          </span>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
            Live Edge AI — {bus}
          </span>
        </div>
        <span className="text-[10px] font-mono text-slate-500">
          updated {secsAgo}s ago
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500">GPS</div>
            <div className="font-mono text-slate-800">
              {gps.latitude?.toFixed(4)}, {gps.longitude?.toFixed(4)}
            </div>
            <div className="text-[10px] text-slate-500">{gps.source || '—'}</div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Video className="w-3.5 h-3.5 text-purple-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500">Road camera</div>
            <div className={`font-mono ${road.status === 'running' ? 'text-emerald-700' : 'text-red-700'}`}>
              ● {road.status || 'unknown'}
            </div>
            <div className="text-[10px] text-slate-500">frame {road.source_frame ?? '—'}</div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Video className="w-3.5 h-3.5 text-purple-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500">Traffic camera</div>
            <div className={`font-mono ${traffic.status === 'running' ? 'text-emerald-700' : 'text-red-700'}`}>
              ● {traffic.status || 'unknown'}
            </div>
            <div className="text-[10px] text-slate-500">frame {traffic.source_frame ?? '—'}</div>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <Car className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-[10px] font-bold uppercase text-slate-500">Vehicles</div>
            <div className="font-mono text-slate-800">
              {traffic.vehicle_count ?? 0} seen
            </div>
            <div className="text-[10px] text-slate-500">
              congestion {traffic.congestion_level || '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
