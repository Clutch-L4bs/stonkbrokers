"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { createChart, CrosshairMode, IChartApi, ISeriesApi, LineData, LineSeries } from "lightweight-charts";

type Props = {
  title: string;
  subtitle?: string;
  data: LineData[];
};

const ACCENT = "#cfff04";
const ACCENT_DIM = "rgba(207,255,4,0.3)";
const ACCENT_LABEL = "rgba(207,255,4,0.85)";
const GRID = "rgba(255,255,255,0.04)";

export function TradingViewChart({ title, subtitle, data }: Props) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const last = useMemo(() => (data.length ? data[data.length - 1] : undefined), [data]);
  const change = useMemo(() => {
    if (data.length < 2) return null;
    const first = data[0].value as number;
    const lastVal = data[data.length - 1].value as number;
    if (!first || first === 0) return null;
    const pct = ((lastVal - first) / first) * 100;
    return { pct, up: pct >= 0 };
  }, [data]);

  useEffect(() => {
    if (!elRef.current) return;

    const chart = createChart(elRef.current, {
      autoSize: true,
      layout: {
        background: { color: "rgba(0,0,0,0)" },
        textColor: "#9e9e9e",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        fontSize: 10
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID }
      },
      rightPriceScale: {
        borderColor: ACCENT_DIM,
        scaleMargins: { top: 0.08, bottom: 0.08 }
      },
      timeScale: {
        borderColor: ACCENT_DIM,
        timeVisible: true,
        secondsVisible: false
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: ACCENT_DIM, labelBackgroundColor: ACCENT_LABEL },
        horzLine: { color: ACCENT_DIM, labelBackgroundColor: ACCENT_LABEL }
      }
    });

    const series = chart.addSeries(LineSeries, {
      color: ACCENT,
      lineWidth: 2,
      priceLineVisible: true,
      priceLineColor: ACCENT_DIM,
      lastValueVisible: true
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const ro = new ResizeObserver(() => chart.timeScale().fitContent());
    ro.observe(elRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData(data);
    chartRef.current?.timeScale().fitContent();
  }, [data]);

  return (
    <div className="bg-lm-black border border-lm-terminal-gray overflow-hidden">
      <div className="px-3 py-2 border-b border-lm-terminal-gray flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="text-white font-bold text-sm">{title}</div>
          {subtitle && <div className="text-lm-terminal-lightgray text-[10px] lm-mono break-all">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-3 text-xs">
          {change !== null && (
            <span className={`font-bold ${change.up ? "text-lm-green" : "text-lm-red"}`}>
              {change.up ? "▲" : "▼"} {change.up ? "+" : ""}{change.pct.toFixed(2)}%
            </span>
          )}
          {last && (
            <span className="text-lm-terminal-lightgray">
              Last: <span className="text-lm-orange lm-mono font-bold">{Number(last.value).toPrecision(6)}</span>
            </span>
          )}
        </div>
      </div>
      <div ref={elRef} className="h-[320px] w-full" />
      {data.length === 0 && (
        <div className="text-center text-lm-terminal-lightgray text-xs py-8 -mt-[320px] relative z-10 space-y-1">
          <div className="text-lg opacity-30">📊</div>
          <div>No chart data yet</div>
          <div className="text-[10px] opacity-50">Select a pool and click Load to view price history</div>
        </div>
      )}
    </div>
  );
}
