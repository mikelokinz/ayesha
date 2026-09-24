import React, { useEffect, useState } from 'react';
import { TrendingDown, Shield, Activity, Cpu } from 'lucide-react';
import { CENTRAL_URL, readJson } from '../../services/edgeApi';

export function MetricsCards() {
  const [bandwidth, setBandwidth] = useState(null);
  const [anpr, setAnpr] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const loadBandwidth = async () => {
      try {
        const data = await readJson(`${CENTRAL_URL}/api/metrics/bandwidth`);
        if (!cancelled) setBandwidth(data);
      } catch (err) {
        if (!cancelled) setBandwidth({ error: err.message });
      }
    };

    const loadAnpr = async () => {
      try {
        const data = await readJson(`${CENTRAL_URL}/api/incidents/anpr`);
        if (!cancelled) setAnpr(data);
      } catch (err) {
        if (!cancelled) setAnpr({ error: err.message });
      }
    };

    loadBandwidth();
    loadAnpr();

    const bwInterval = setInterval(loadBandwidth, 30000);
    const anprInterval = setInterval(loadAnpr, 15000);

    return () => {
      cancelled = true;
      clearInterval(bwInterval);
      clearInterval(anprInterval);
    };
  }, []);

  const reduction = bandwidth?.reduction_ratio;
  const rawGB = bandwidth?.counterfactual?.raw_video_gb_per_bus_per_day;
  const edgeBytes = bandwidth?.edge_metadata_bytes_total;
  const anprCount = anpr?.count ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Bandwidth Reduction */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Bandwidth Reduction
          </span>
          <TrendingDown className="w-4 h-4 text-green-600" />
        </div>
        <div className="text-2xl font-black text-green-700">
          {reduction ? `${reduction.toLocaleString()}×` : '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {rawGB ? `vs ${rawGB} GB/bus/day raw video` : 'Loading…'}
        </div>
      </div>

      {/* Events Captured */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Events Captured
          </span>
          <Activity className="w-4 h-4 text-blue-600" />
        </div>
        <div className="text-2xl font-black text-blue-700">
          {bandwidth?.events_observed?.toLocaleString() ?? '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {edgeBytes ? `${(edgeBytes / 1024).toFixed(0)} KB edge metadata` : 'Loading…'}
        </div>
      </div>

      {/* ANPR Incidents */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            ANPR Incidents
          </span>
          <Shield className="w-4 h-4 text-red-600" />
        </div>
        <div className={`text-2xl font-black ${anprCount > 0 ? 'text-red-700' : 'text-slate-400'}`}>
          {anpr ? anprCount : '—'}
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          {anprCount === 0 ? 'No plates detected yet' : `${anprCount} plate events`}
        </div>
      </div>

      {/* Edge Device */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Edge Device
          </span>
          <Cpu className="w-4 h-4 text-purple-600" />
        </div>
        <div className="text-2xl font-black text-purple-700">
          CPU
        </div>
        <div className="text-[11px] text-slate-500 mt-1">
          Intel i3 · 100 ms/frame
        </div>
      </div>
    </div>
  );
}
