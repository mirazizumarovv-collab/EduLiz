import React from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../../../context/AppContext.jsx";

export function TrendLineChart({ data, dataKey, xKey, height = 110, domain, stroke, tickColor }) {
  const { theme } = useApp();
  const c = theme.colors;
  const lineColor = stroke || c.accent;
  const tick = tickColor || c.textSecondary;
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: tick }} axisLine={false} tickLine={false} />
          <YAxis hide={!domain} domain={domain} tick={{ fontSize: 10, fill: tick }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${c.tint}`, background: c.surface, color: c.textPrimary }} />
          <Line type="monotone" dataKey={dataKey} stroke={lineColor} strokeWidth={2.5} dot={{ r: 3, fill: lineColor }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
