import React from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { useApp } from "../../../context/AppContext.jsx";

// `data` must be ONE unified array of row objects (e.g. { month, Mathematics, English }),
// never per-line data — that's what caused the earlier alignment bug.
// `series` is [{ key, name, color }] describing each line to draw from that shared data.
export function MultiLineChart({ data, series, height = 150, domain }) {
  const { theme } = useApp();
  const c = theme.colors;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: c.textSecondary }} axisLine={false} tickLine={false} />
          <YAxis hide={!domain} domain={domain} tick={{ fontSize: 10, fill: c.textSecondary }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${c.tint}`, background: c.surface, color: c.textPrimary }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {series.map(s => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.2} dot={{ r: 3, fill: s.color }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
