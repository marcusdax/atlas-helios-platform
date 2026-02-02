import React from 'react';
import ReactECharts from 'echarts-for-react';

const PredictionChart = () => {
  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985'
        }
      },
      backgroundColor: '#1f2937',
      borderColor: '#374151',
      textStyle: {
        color: '#e5e7eb'
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['6AM', '8AM', '10AM', '12PM', '2PM', '4PM', '6PM', '8PM', '10PM', '12AM', '2AM', '4AM'],
      axisLine: {
        lineStyle: {
          color: '#6b7280'
        }
      },
      axisLabel: {
        color: '#9ca3af'
      }
    },
    yAxis: {
      type: 'value',
      name: 'Probability %',
      nameTextStyle: {
        color: '#9ca3af'
      },
      axisLine: {
        lineStyle: {
          color: '#6b7280'
        }
      },
      axisLabel: {
        color: '#9ca3af'
      },
      splitLine: {
        lineStyle: {
          color: '#374151'
        }
      }
    },
    series: [
      {
        name: 'Storm Probability',
        type: 'line',
        stack: 'Total',
        smooth: true,
        lineStyle: {
          width: 3,
          color: '#dc2626'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(220, 38, 38, 0.3)'
            }, {
              offset: 1, color: 'rgba(220, 38, 38, 0.05)'
            }]
          }
        },
        emphasis: {
          focus: 'series'
        },
        data: [15, 25, 45, 68, 85, 92, 87, 78, 65, 45, 30, 20]
      },
      {
        name: 'Hail Risk',
        type: 'line',
        stack: 'Total',
        smooth: true,
        lineStyle: {
          width: 2,
          color: '#d97706'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [{
              offset: 0, color: 'rgba(217, 119, 6, 0.2)'
            }, {
              offset: 1, color: 'rgba(217, 119, 6, 0.05)'
            }]
          }
        },
        emphasis: {
          focus: 'series'
        },
        data: [5, 12, 28, 45, 67, 78, 72, 58, 42, 25, 15, 8]
      }
    ]
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
};

export default PredictionChart;