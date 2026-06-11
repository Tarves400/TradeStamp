import React, { useMemo, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop, Line, Circle, Text as SvgText } from 'react-native-svg';
import { useTradeStore } from '@/lib/tradeStore';

type Props = { points: number[]; height?: number };

export default function EquityChart({ points, height = 200 }: Props) {
  const { colors } = useTradeStore();
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 48; // 24px padding each side
  const pad = { top: 16, bottom: 28, left: 44, right: 16 };
  const innerW = chartWidth - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    const pts = points.length < 2 ? [0, ...points] : points;
    const maxVal = Math.max(...pts, 10);
    const minVal = Math.min(...pts, 0);
    const range = maxVal - minVal || 1;

    const getX = (i: number) => pad.left + (i / (pts.length - 1)) * innerW;
    const getY = (v: number) => pad.top + innerH - ((v - minVal) / range) * innerH;

    const linePath = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`).join(' ');
    const areaPath = linePath + ` L ${getX(pts.length - 1).toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${pad.left.toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;

    // grid labels
    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
      const value = minVal + fraction * range;
      const y = pad.top + innerH - fraction * innerH;
      return { y, label: `$${Math.round(value)}` };
    });

    return { pts, getX, getY, linePath, areaPath, gridLines, maxVal, minVal, range };
  }, [points, innerW, innerH, pad.left, pad.top]);

  const hoverPoint = hoverIdx !== null ? {
    x: data.getX(hoverIdx),
    y: data.getY(data.pts[hoverIdx]),
    value: data.pts[hoverIdx],
    delta: hoverIdx > 0 ? data.pts[hoverIdx] - data.pts[hoverIdx - 1] : 0,
  } : null;

  return (
    <View>
      <Svg width={chartWidth} height={height}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.25" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {data.gridLines.map((g, i) => (
          <React.Fragment key={i}>
            <Line
              x1={pad.left} y1={g.y}
              x2={pad.left + innerW} y2={g.y}
              stroke={colors.border} strokeWidth={0.8}
            />
            <SvgText
              x={pad.left - 6} y={g.y + 4}
              fontSize={9} fill={colors.textMuted}
              textAnchor="end"
            >
              {g.label}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Area fill */}
        <Path d={data.areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <Path d={data.linePath} fill="none" stroke={colors.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* Hover crosshair */}
        {hoverPoint && (
          <>
            <Line
              x1={hoverPoint.x} y1={pad.top}
              x2={hoverPoint.x} y2={pad.top + innerH}
              stroke={colors.label} strokeWidth={1} strokeDasharray="4,4"
            />
            <Circle cx={hoverPoint.x} cy={hoverPoint.y} r={5} fill={colors.label} />
            <Circle cx={hoverPoint.x} cy={hoverPoint.y} r={3} fill={colors.bg} />
          </>
        )}
      </Svg>

      {/* Hover tooltip */}
      {hoverPoint && (
        <View
          style={{
            position: 'absolute',
            top: 4,
            left: Math.min(hoverPoint.x - 10, chartWidth - 140),
            backgroundColor: colors.panel,
            borderWidth: 1,
            borderColor: colors.accent,
            borderRadius: 6,
            padding: 8,
            minWidth: 130,
          }}
        >
          <Text style={{ fontSize: 10, color: colors.textMuted, marginBottom: 2 }}>Point #{hoverIdx}</Text>
          <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700' }}>
            ${hoverPoint.value.toFixed(2)}
          </Text>
          <Text style={{
            fontSize: 11, fontWeight: '600',
            color: hoverPoint.delta >= 0 ? colors.accent : colors.danger,
          }}>
            {hoverPoint.delta >= 0 ? '+' : ''}${hoverPoint.delta.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}
