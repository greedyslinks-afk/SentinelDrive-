import React, { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { MapPin, Navigation, Activity, Map as MapIcon } from 'lucide-react';

// Mock data for GPS analysis
const speedData = [
  { time: '08:00', speed: 25, limit: 30 },
  { time: '08:15', speed: 45, limit: 45 },
  { time: '08:30', speed: 65, limit: 65 },
  { time: '08:45', speed: 55, limit: 65 },
  { time: '09:00', speed: 30, limit: 35 },
  { time: '09:15', speed: 20, limit: 25 },
];

const roadTypeData = [
  { name: 'Highway', value: 45 },
  { name: 'City', value: 35 },
  { name: 'Residential', value: 20 },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b'];

const hardEventsData = [
  { day: 'Mon', stops: 2, turns: 1 },
  { day: 'Tue', stops: 0, turns: 0 },
  { day: 'Wed', stops: 1, turns: 2 },
  { day: 'Thu', stops: 3, turns: 1 },
  { day: 'Fri', stops: 1, turns: 0 },
];

const commonRoutes = [
  { id: 1, name: 'Home to Work', color: '#6366f1', path: 'M 20 80 Q 40 20, 80 40 T 140 60', distance: '12.4 mi', avgSpeed: '35 mph', estTime: '24 min' },
  { id: 2, name: 'Work to Gym', color: '#10b981', path: 'M 140 60 Q 160 100, 120 120 T 80 140', distance: '4.2 mi', avgSpeed: '25 mph', estTime: '12 min' },
  { id: 3, name: 'Grocery Run', color: '#f59e0b', path: 'M 20 80 Q 10 120, 40 140 T 80 140', distance: '2.1 mi', avgSpeed: '20 mph', estTime: '8 min' },
];

const CustomSpeedTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl">
        <p className="text-zinc-400 text-xs mb-2 font-medium">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-zinc-300">{entry.name}</span>
              </div>
              <span className="font-mono font-medium text-white">{entry.value} mph</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const CustomEventsTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900/95 backdrop-blur-md border border-white/10 p-3 rounded-lg shadow-xl">
        <p className="text-zinc-400 text-xs mb-2 font-medium">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-zinc-300">{entry.name}</span>
              </div>
              <span className="font-mono font-medium text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function GPSAnalysis() {
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  return (
    <div className="h-full flex gap-6 overflow-x-auto custom-scrollbar pb-2">
      {/* Common Routes Map */}
      <div className="min-w-[300px] flex-1 bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-zinc-400 mb-4">
          <MapIcon className="w-4 h-4" />
          <span className="text-sm font-medium">Common Routes</span>
        </div>
        <div className="flex-1 min-h-[150px] relative rounded-xl overflow-hidden bg-zinc-950 border border-white/5 flex items-center justify-center">
          {/* Mock Map Background */}
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '16px 16px'
          }} />
          
          {/* SVG Routes */}
          <svg className="w-full h-full absolute inset-0" viewBox="0 0 180 160" preserveAspectRatio="xMidYMid meet">
            {commonRoutes.map(route => {
              const isSelected = selectedRouteId === route.id;
              const isDimmed = selectedRouteId !== null && !isSelected;
              return (
                <g 
                  key={route.id}
                  className={`cursor-pointer transition-all duration-300 hover:opacity-100 ${isDimmed ? 'opacity-20' : 'opacity-80'}`}
                  onClick={() => setSelectedRouteId(isSelected ? null : route.id)}
                >
                  {/* Invisible wider path for easier clicking */}
                  <path 
                    d={route.path} 
                    fill="none" 
                    stroke="transparent" 
                    strokeWidth="16" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                  <path 
                    d={route.path} 
                    fill="none" 
                    stroke={route.color} 
                    strokeWidth={isSelected ? "6" : "4"} 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="drop-shadow-md"
                  />
                  {/* Start/End dots */}
                  <circle cx={route.path.split(' ')[1]} cy={route.path.split(' ')[2]} r={isSelected ? "4" : "3"} fill={route.color} />
                  <circle cx={route.path.split(' ').pop()?.split(' ')[0] || 0} cy={route.path.split(' ').pop()?.split(' ')[1] || 0} r={isSelected ? "4" : "3"} fill={route.color} />
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-3 min-h-[60px] flex items-end">
          {selectedRouteId ? (
            <div className="w-full bg-zinc-900/80 rounded-lg p-3 border border-white/10 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: commonRoutes.find(r => r.id === selectedRouteId)?.color }} />
                  <span className="text-sm font-medium text-white">{commonRoutes.find(r => r.id === selectedRouteId)?.name}</span>
                </div>
                <button onClick={() => setSelectedRouteId(null)} className="text-[10px] text-zinc-400 hover:text-white uppercase tracking-wider font-medium">Close</button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-black/30 rounded p-1.5">
                  <div className="text-[10px] text-zinc-500 mb-0.5">Dist</div>
                  <div className="text-xs text-zinc-300 font-mono">{commonRoutes.find(r => r.id === selectedRouteId)?.distance}</div>
                </div>
                <div className="bg-black/30 rounded p-1.5">
                  <div className="text-[10px] text-zinc-500 mb-0.5">Time</div>
                  <div className="text-xs text-zinc-300 font-mono">{commonRoutes.find(r => r.id === selectedRouteId)?.estTime}</div>
                </div>
                <div className="bg-black/30 rounded p-1.5">
                  <div className="text-[10px] text-zinc-500 mb-0.5">Avg</div>
                  <div className="text-xs text-zinc-300 font-mono">{commonRoutes.find(r => r.id === selectedRouteId)?.avgSpeed}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 w-full">
              {commonRoutes.map(route => (
                <button 
                  key={route.id} 
                  onClick={() => setSelectedRouteId(route.id)}
                  className="flex items-center gap-1.5 hover:bg-white/5 px-2 py-1.5 rounded-md transition-colors border border-transparent hover:border-white/5"
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: route.color }} />
                  <span className="text-xs text-zinc-300">{route.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Speed Over Time */}
      <div className="min-w-[300px] flex-1 bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-zinc-400 mb-4">
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">Speed Profile</span>
        </div>
        <div className="flex-1 min-h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speedData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="time" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomSpeedTooltip />} cursor={{ stroke: '#ffffff20', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Line type="monotone" dataKey="speed" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} name="Speed" />
              <Line type="monotone" dataKey="limit" stroke="#ffffff40" strokeWidth={2} strokeDasharray="4 4" dot={false} activeDot={{ r: 4, fill: '#ffffff80', strokeWidth: 0 }} name="Speed Limit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Road Types */}
      <div className="min-w-[250px] bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-zinc-400 mb-4">
          <MapPin className="w-4 h-4" />
          <span className="text-sm font-medium">Road Types</span>
        </div>
        <div className="flex-1 min-h-[150px] flex items-center justify-center relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={roadTypeData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {roadTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff10', borderRadius: '8px' }}
                itemStyle={{ color: '#e4e4e7' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-zinc-500 font-medium">Routes</span>
          </div>
        </div>
        <div className="flex justify-center gap-3 mt-2">
          {roadTypeData.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
              <span className="text-[10px] text-zinc-400">{entry.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hard Events */}
      <div className="min-w-[300px] flex-1 bg-zinc-900/50 rounded-2xl border border-white/5 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-zinc-400 mb-4">
          <Navigation className="w-4 h-4" />
          <span className="text-sm font-medium">Hard Events</span>
        </div>
        <div className="flex-1 min-h-[150px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hardEventsData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis dataKey="day" stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#ffffff50" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomEventsTooltip />} cursor={{ fill: '#ffffff05' }} />
              <Legend 
                verticalAlign="top" 
                height={36} 
                iconType="circle" 
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', color: '#a1a1aa' }}
              />
              <Bar dataKey="stops" fill="#f43f5e" name="Hard Stops" stackId="a" />
              <Bar dataKey="turns" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Hard Turns" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
