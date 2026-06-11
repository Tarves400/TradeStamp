import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line } from 'react-native-svg';

// পূর্ব-নির্ধারিত ক্যান্ডেলস্টিক ডেটা — গোল্ডেন লুক্সারি ওয়াটারমার্কের জন্য
const CANDLES = [
  { x: 10,  open: 120, close: 80,  high: 70,  low: 135 },
  { x: 28,  open: 90,  close: 130, high: 75,  low: 140 },
  { x: 46,  open: 130, close: 100, high: 88,  low: 148 },
  { x: 64,  open: 105, close: 140, high: 92,  low: 150 },
  { x: 82,  open: 140, close: 115, high: 100, low: 158 },
  { x: 100, open: 110, close: 150, high: 95,  low: 162 },
  { x: 118, open: 150, close: 125, high: 110, low: 165 },
  { x: 136, open: 120, close: 158, high: 108, low: 168 },
  { x: 154, open: 155, close: 118, high: 105, low: 172 },
  { x: 172, open: 115, close: 162, high: 100, low: 175 },
  { x: 190, open: 160, close: 125, high: 112, low: 178 },
  { x: 208, open: 122, close: 165, high: 108, low: 180 },
  { x: 226, open: 162, close: 130, high: 115, low: 182 },
  { x: 244, open: 128, close: 168, high: 110, low: 185 },
  { x: 262, open: 165, close: 140, high: 125, low: 188 },
  { x: 280, open: 138, close: 172, high: 120, low: 190 },
  { x: 298, open: 170, close: 145, high: 130, low: 192 },
  { x: 316, open: 142, close: 175, high: 125, low: 195 },
  { x: 334, open: 172, close: 150, high: 135, low: 198 },
  { x: 352, open: 148, close: 178, high: 130, low: 200 },
];

const CANDLE_WIDTH = 12;
const GOLD = 'rgba(212,168,60,0.18)';
const GOLD_WICK = 'rgba(212,168,60,0.12)';
const CHART_HEIGHT = 200;

interface Props {
  /** স্ক্রিনের ফুল উইডথ অথবা কাস্টম উইডথ */
  width?: number;
  height?: number;
  opacity?: number;
}

export default function CandlestickBackground({ width: propWidth, height = CHART_HEIGHT, opacity = 1 }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const width = propWidth ?? screenWidth;

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        opacity,
        pointerEvents: 'none',
      }}
      pointerEvents="none"
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {CANDLES.map((c, i) => {
          const isBull = c.close < c.open; // নিচে = বুলিশ (চার্ট উল্টানো)
          const bodyTop = Math.min(c.open, c.close);
          const bodyHeight = Math.abs(c.open - c.close);
          const centerX = c.x + CANDLE_WIDTH / 2;
          const fill = isBull ? 'rgba(180,230,140,0.18)' : 'rgba(240,100,100,0.15)';
          const stroke = isBull ? 'rgba(100,220,80,0.25)' : 'rgba(220,80,80,0.22)';

          return (
            <React.Fragment key={i}>
              {/* Wick */}
              <Line
                x1={centerX} y1={c.high}
                x2={centerX} y2={c.low}
                stroke={GOLD_WICK}
                strokeWidth={1}
              />
              {/* Body */}
              <Rect
                x={c.x}
                y={bodyTop}
                width={CANDLE_WIDTH}
                height={Math.max(bodyHeight, 2)}
                fill={fill}
                stroke={stroke}
                strokeWidth={0.8}
                rx={1.5}
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}
