// ============================================================
// charts.js —— 协议对比雷达图（ECharts）
// ============================================================
(function () {
  'use strict';
  var el = document.getElementById('chart-radar');
  if (!el || typeof echarts === 'undefined') return;

  var style = getComputedStyle(document.documentElement);
  var cUart = style.getPropertyValue('--c-uart').trim() || '#2E8BFF';
  var cI2c = style.getPropertyValue('--c-i2c').trim() || '#0FA3A0';
  var cSpi = style.getPropertyValue('--c-spi').trim() || '#F59E0B';
  var cCan = style.getPropertyValue('--c-can').trim() || '#EF4444';
  var ink = style.getPropertyValue('--ink').trim() || '#171E2E';
  var muted = style.getPropertyValue('--muted').trim() || '#5B6679';

  var chart = echarts.init(el, null, { renderer: 'svg' });
  var indicators = [
    { name: '传输速度', max: 100 },
    { name: '抗干扰能力', max: 100 },
    { name: '可靠性与容错', max: 100 },
    { name: '多设备扩展性', max: 100 },
    { name: '易用性 / 低成本', max: 100 }
  ];

  chart.setOption({
    animation: false,
    tooltip: { trigger: 'item', appendToBody: true },
    legend: {
      bottom: 0,
      textStyle: { color: ink, fontFamily: 'WorkSans, "PingFang SC", sans-serif' }
    },
    radar: {
      indicator: indicators,
      radius: '62%',
      center: ['50%', '46%'],
      splitNumber: 4,
      axisName: { color: muted, fontFamily: 'WorkSans, "PingFang SC", sans-serif', fontSize: 12 },
      splitLine: { lineStyle: { color: 'rgba(23,30,46,.12)' } },
      splitArea: { areaStyle: { color: ['rgba(78,107,255,.02)', 'rgba(255,255,255,.01)'] } },
      axisLine: { lineStyle: { color: 'rgba(23,30,46,.15)' } }
    },
    series: [{
      type: 'radar',
      data: [
        { value: [38, 22, 15, 8, 92], name: 'UART', itemStyle: { color: cUart }, areaStyle: { color: cUart, opacity: .18 }, lineStyle: { width: 2.5 } },
        { value: [45, 45, 55, 88, 78], name: 'I2C', itemStyle: { color: cI2c }, areaStyle: { color: cI2c, opacity: .18 }, lineStyle: { width: 2.5 } },
        { value: [96, 42, 25, 30, 82], name: 'SPI', itemStyle: { color: cSpi }, areaStyle: { color: cSpi, opacity: .18 }, lineStyle: { width: 2.5 } },
        { value: [62, 96, 96, 90, 38], name: 'CAN', itemStyle: { color: cCan }, areaStyle: { color: cCan, opacity: .18 }, lineStyle: { width: 2.5 } }
      ]
    }]
  });

  window.addEventListener('resize', function () { chart.resize(); });
})();
