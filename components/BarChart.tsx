// Простой столбчатый график на инлайн-SVG (без внешних библиотек, темизируется).
export function BarChart({
  data,
  color = "var(--accent)",
  height = 200,
  formatValue = (n: number) => String(n),
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;
  const gap = 14;
  const barW = 46;
  const chartH = height;
  const topPad = 26; // место для подписи значения
  const width = n * barW + (n - 1) * gap;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={chartH + 28} viewBox={`0 0 ${width} ${chartH + 28}`} style={{ maxWidth: "100%", minWidth: n * 40 }}>
        {/* сетка */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = topPad + (chartH - topPad) * (1 - t);
          return <line key={t} x1={0} x2={width} y1={y} y2={y} stroke="var(--line-2)" strokeWidth={1} />;
        })}
        {data.map((d, i) => {
          const h = ((chartH - topPad) * d.value) / max;
          const x = i * (barW + gap);
          const y = chartH - h;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(h, d.value > 0 ? 2 : 0)} rx={6} fill={color} opacity={0.9} />
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 7} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--ink-2)">
                  {formatValue(d.value)}
                </text>
              )}
              <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
