import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { DATA_STATES } from '@atlas/dashboard-data';
import { Skeleton, treatmentFor, DataStateNote } from '../ui/DataStateBadge';

/**
 * The 24-hour precipitation outlook.
 *
 * What this replaced: two stacked ECharts series named "Storm Probability" and
 * "Hail Risk", both literal arrays of twelve numbers, under a heading that said
 * "24-Hour Weather Forecast". Nothing fetched anything. The numbers were also
 * *stacked*, so the shape on screen was the sum of two invented probabilities -
 * a quantity with no meaning at all.
 *
 * It now plots the NWS hourly grid for the first monitored region, by way of
 * the dashboard's forecast lane. Three deliberate choices:
 *
 * ONE MEASURE, ONE AXIS. Precipitation probability is a percentage and wind is
 * mph; putting both on one plot needs two y-scales, and a dual-axis chart lets
 * the reader infer a correlation from whatever the two scalings happen to make
 * cross. Wind gets a stat beside the title instead - a number is the right form
 * for a single value, and it keeps the plot honest.
 *
 * NO STACKING. A probability series is not additive.
 *
 * ONE LABEL. The peak hour is labelled directly; nothing else is. A number on
 * every point is noise, and the peak is the only one anyone dispatches on.
 *
 * @param {object} props
 * @param {import('@atlas/dashboard-data').ForecastPoint[]} props.forecast
 * @param {import('@atlas/dashboard-data').DataState} [props.state]
 * @param {'nws'|'mock'|null} [props.source]
 * @param {string[]} [props.failedSources]
 * @param {number|null} [props.fetchedAt]
 * @param {() => void} [props.onRetry]
 */
const PredictionChart = ({
  forecast = [],
  state = DATA_STATES.LIVE,
  source = null,
  failedSources = [],
  fetchedAt = null,
  onRetry
}) => {
  const treatment = treatmentFor(state);
  const firstRead = state === DATA_STATES.SYNCING && fetchedAt === null;
  const laneDown = failedSources.includes('forecast');

  const peak = useMemo(
    () => forecast.reduce(
      (worst, point) => (point.precipitationProbability > (worst?.precipitationProbability ?? -1) ? point : worst),
      null
    ),
    [forecast]
  );

  const peakWind = useMemo(
    () => forecast.reduce((max, p) => (p.windSpeed !== null && p.windSpeed > max ? p.windSpeed : max), 0),
    [forecast]
  );

  const option = useMemo(() => {
    const hour = (ms) => new Date(ms).toLocaleTimeString([], { hour: 'numeric' });

    return {
      animation: false,
      grid: { left: 8, right: 14, top: 18, bottom: 6, containLabel: true },

      // Crosshair plus the NWS's own phrase for that hour: the forecast in
      // words is what makes a 60% mean something.
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: '#525252' } },
        backgroundColor: '#0a0a0a',
        borderColor: '#404040',
        textStyle: { color: '#e5e5e5', fontSize: 12 },
        formatter: (params) => {
          const index = params?.[0]?.dataIndex;
          const point = forecast[index];
          if (!point) return '';
          const rows = [
            `<strong>${new Date(point.time).toLocaleTimeString([], { hour: 'numeric' })}</strong>`,
            `${point.precipitationProbability}% chance of precipitation`
          ];
          if (point.windSpeed !== null) rows.push(`wind to ${point.windSpeed} mph`);
          if (point.temperature !== null) rows.push(`${point.temperature}&deg;F`);
          if (point.shortForecast) rows.push(`<span style="color:#a3a3a3">${point.shortForecast}</span>`);
          return rows.join('<br/>');
        }
      },

      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: forecast.map((p) => hour(p.time)),
        // Recessive axes: the data is the subject.
        axisLine: { lineStyle: { color: '#404040' } },
        axisTick: { show: false },
        axisLabel: { color: '#a3a3a3', fontSize: 11, interval: 3 }
      },

      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: '#a3a3a3', fontSize: 11, formatter: '{value}%' },
        splitLine: { lineStyle: { color: '#262626' } }
      },

      series: [{
        name: 'Chance of precipitation',
        type: 'line',
        smooth: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: false,
        lineStyle: { width: 2, color: '#0284c7' },
        itemStyle: { color: '#0284c7' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(2, 132, 199, 0.35)' },
              { offset: 1, color: 'rgba(2, 132, 199, 0.02)' }
            ]
          }
        },
        data: forecast.map((p) => p.precipitationProbability),
        // Only the peak carries a number.
        markPoint: peak ? {
          symbol: 'circle',
          symbolSize: 8,
          itemStyle: { color: '#0284c7', borderColor: '#171717', borderWidth: 2 },
          label: {
            formatter: `${peak.precipitationProbability}%`,
            position: 'top',
            distance: 8,
            color: '#e5e5e5',
            fontSize: 11,
            fontWeight: 600
          },
          data: [{ coord: [forecast.indexOf(peak), peak.precipitationProbability] }]
        } : undefined
      }]
    };
  }, [forecast, peak]);

  return (
    <div className="flex h-full flex-col">
      {/*
        The demo generator is labelled rather than hidden. The backend only
        serves it when WEATHER_ALLOW_MOCK is on, and when it does, saying so is
        the whole difference between this panel and the one it replaced.
      */}
      {source === 'mock' && (
        <p className="mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          Demo forecast — the NOAA feed is not connected.
        </p>
      )}

      <DataStateNote
        state={laneDown ? DATA_STATES.DEGRADED : state}
        failedSources={laneDown ? ['forecast'] : []}
        fetchedAt={fetchedAt}
        onRetry={onRetry}
      />

      {firstRead ? (
        <div className="flex flex-1 items-end gap-1.5 px-1 pb-6" aria-hidden="true">
          {[40, 55, 35, 70, 85, 60, 45, 30, 50, 65, 40, 25].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      ) : forecast.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center">
          <p className="max-w-xs text-sm text-neutral-400">
            {laneDown || state === DATA_STATES.OFFLINE
              ? 'No forecast is available right now.'
              : 'No monitored region is configured, so there is nowhere to forecast for.'}
          </p>
        </div>
      ) : (
        <>
          {/*
            Wind as a stat, not a second y-axis. A single value reads better as
            a number than as a line nobody can scale against the percentages.
          */}
          <div className="mb-1 flex items-baseline gap-4 text-xs">
            <span className="text-neutral-400">
              Peak wind{' '}
              <span className={`font-semibold text-neutral-100 ${treatment.dim}`}>
                {peakWind > 0 ? `${peakWind} mph` : '—'}
              </span>
            </span>
            {peak && (
              <span className="text-neutral-400">
                Wettest hour{' '}
                <span className={`font-semibold text-neutral-100 ${treatment.dim}`}>
                  {new Date(peak.time).toLocaleTimeString([], { hour: 'numeric' })}
                </span>
              </span>
            )}
          </div>

          <div className={`min-h-0 flex-1 ${treatment.dim}`}>
            <ReactECharts
              option={option}
              style={{ height: '100%', width: '100%' }}
              opts={{ renderer: 'svg' }}
              notMerge
            />
          </div>
        </>
      )}
    </div>
  );
};

export default PredictionChart;
