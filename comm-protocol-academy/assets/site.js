// ============================================================
// site.js —— 导航、I2C 动画时序、SPI 模式、CAN 帧互动、测验
// ============================================================
(function () {
  'use strict';

  /* ---------------- 工具 ---------------- */
  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  /* =====================================================
     1. 导航滚动高亮 + 返回顶部
  ===================================================== */
  var navLinks = $all('#navLinks a');
  var sections = ['academy', 'overview', 'uart', 'i2c', 'spi', 'can', 'compare', 'glossary', 'interview', 'quiz'];
  var backTop = $('#backTop');

  function onScroll() {
    var pos = window.scrollY + 100;
    var cur = 'overview';
    sections.forEach(function (id) {
      var sec = document.getElementById(id);
      if (sec && sec.offsetTop <= pos) cur = id;
    });
    navLinks.forEach(function (a) {
      a.classList.toggle('on', a.getAttribute('href') === '#' + cur);
    });
    if (backTop) backTop.classList.toggle('show', window.scrollY > 600);
    // 阅读进度条
    var doc = document.documentElement;
    var max = doc.scrollHeight - doc.clientHeight;
    var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    var rp = $('#readProgress');
    if (rp) rp.style.width = pct + '%';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backTop) backTop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // 汉堡菜单（移动端导航）
  var hamburger = $('#hamburger');
  var navPanel = $('#navLinks');
  if (hamburger && navPanel) {
    hamburger.addEventListener('click', function () {
      var open = navPanel.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navPanel.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') {
        navPanel.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* =====================================================
     2. 通用标签页按钮高亮
  ===================================================== */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab-btn');
    if (!btn) return;
    var group = btn.parentElement;
    $all('.tab-btn', group).forEach(function (b) { b.classList.remove('on'); });
    btn.classList.add('on');
  });

  /* =====================================================
     3. I2C 动画时序图
  ===================================================== */
  function buildI2C() {
    var sclEl = $('#i2cScl'), sdaEl = $('#i2cSda'), legendEl = $('#i2cLegend');
    if (!sclEl || !sdaEl) return;

    var W = 40, H = 46, top = 6, padL = 16;
    var ADDRW = [1, 0, 1, 0, 0, 0, 0, 0];   // 0x50 + W → 10100000
    var ADDRR = [1, 0, 1, 0, 0, 0, 0, 1];   // 0x50 + R → 10100001
    var REG   = [0, 0, 0, 0, 0, 0, 0, 0];   // 寄存器地址 0x00
    var DATA  = [0, 0, 1, 0, 1, 0, 1, 0];   // 数据 0x2A

    var mode = 'write';
    var cells = [], starts = [], totalW = 0, end = 0, vbW = 0, vbH = 132;
    var timer = null, step = -1, playing = false;

    function isAddrSeg(i) { return cells[i].seg === 'addr1' || cells[i].seg === 'addr2'; }
    function isRegSeg(i) { return cells[i].seg === 'reg'; }
    function isDataSeg(i) { return cells[i].seg === 'data'; }

    function buildCells() {
      cells = [];
      if (mode === 'write') {
        cells.push({ type: 'start', sr: false, w: 1.35 });
        ADDRW.forEach(function (b) { cells.push({ type: 'bit', v: b, seg: 'addr1', w: 1 }); });
        cells.push({ type: 'ack', w: 1 });
        DATA.forEach(function (b) { cells.push({ type: 'bit', v: b, seg: 'data', w: 1 }); });
        cells.push({ type: 'ack', w: 1 });
        cells.push({ type: 'stop', w: 1.35 });
      } else {
        cells.push({ type: 'start', sr: false, w: 1.35 });
        ADDRW.forEach(function (b) { cells.push({ type: 'bit', v: b, seg: 'addr1', w: 1 }); });
        cells.push({ type: 'ack', w: 1 });
        REG.forEach(function (b) { cells.push({ type: 'bit', v: b, seg: 'reg', w: 1 }); });
        cells.push({ type: 'ack', w: 1 });
        cells.push({ type: 'start', sr: true, w: 1.35 });                 // 重复起始
        ADDRR.forEach(function (b) { cells.push({ type: 'bit', v: b, seg: 'addr2', w: 1 }); });
        cells.push({ type: 'ack', w: 1 });
        DATA.forEach(function (b) { cells.push({ type: 'bit', v: b, seg: 'data', w: 1 }); });
        cells.push({ type: 'nack', w: 1 });
        cells.push({ type: 'stop', w: 1.35 });
      }
      totalW = padL * 2; starts = [];
      cells.forEach(function (c) { starts.push(totalW - padL); totalW += c.w * W; });
      end = totalW - padL; vbW = totalW;
    }

    function phaseName(c) {
      if (c.type === 'start') return c.sr ? 'Sr' : 'S';
      if (c.type === 'stop') return 'P';
      if (c.type === 'ack') return 'ACK';
      if (c.type === 'nack') return 'NACK';
      return c.v ? '1' : '0';
    }
    function phaseColor(c) {
      if (c.type === 'start') return '#8B5CF6';
      if (c.type === 'stop') return '#EF4444';
      if (c.type === 'ack') return '#0FA3A0';
      if (c.type === 'nack') return '#C53030';
      return '#4E6BFF';
    }
    function phaseTitle(c, i) {
      if (c.type === 'start') return c.sr ? '重复起始条件' : '起始条件 START';
      if (c.type === 'stop') return '停止条件 STOP';
      if (c.type === 'ack') return (isAddrSeg(i) || isRegSeg(i) ? '应答 ACK' : '数据段应答 ACK');
      if (c.type === 'nack') return '主机 NACK（读结束）';
      if (isAddrSeg(i)) return '地址位 = ' + c.v;
      if (isRegSeg(i)) return '寄存器地址位 = ' + c.v;
      return '数据位 = ' + c.v;
    }

    // ---- SCL 波形路径 ----
    function sclPath() {
      var d = 'M' + (padL - 10) + ' ' + top;
      cells.forEach(function (c, i) {
        var s = starts[i], e = s + c.w * W;
        if (c.type === 'start' || c.type === 'stop') {
          d += ' H' + e;
        } else {
          d += ' L' + s + ' ' + (top + H);
          d += ' H' + (s + c.w * W / 2);
          d += ' L' + (s + c.w * W / 2) + ' ' + top;
          d += ' H' + e;
        }
      });
      return d + ' H' + (end + 10);
    }

    // ---- SDA 电平分段 ----
    function sdaSegs() {
      var segs = [], cur = 1, cursor = padL - 10;
      function push(x0, x1, lv) { segs.push([x0, x1, lv]); }
      cells.forEach(function (c, i) {
        var s = starts[i], e = s + c.w * W;
        if (c.type === 'start') {
          if (c.sr) {
            // 重复起始：先回高再降下（SCL 高期间 SDA 低→高→低）
            push(cursor, s, cur);
            push(s, s, 1);
            push(s, s + c.w * W * 0.35, 1);
            push(s + c.w * W * 0.35, s + c.w * W * 0.35, 0);
            push(s + c.w * W * 0.35, e, 0);
          } else {
            push(cursor, s, cur);
            push(s, s, 1);
            push(s, e, 0);
          }
          cur = 0; cursor = e;
        } else if (c.type === 'stop') {
          push(cursor, s, cur);
          push(s, s, 0);
          push(s, e, 1);
          cur = 1; cursor = e;
        } else if (c.type === 'ack') {
          push(cursor, s, cur);
          push(s, e, 0);
          cur = 0; cursor = e;
        } else if (c.type === 'nack') {
          // NACK：接收方释放 SDA → 保持高
          push(cursor, s, cur);
          push(s, e, 1);
          cur = 1; cursor = e;
        } else {
          var val = c.v;
          var chgAt = s + c.w * W * 0.25;
          push(cursor, Math.min(chgAt, s), cur);
          if (chgAt > s) push(s, chgAt, cur);
          push(chgAt, chgAt, val);
          push(chgAt, e, val);
          cur = val; cursor = e;
        }
      });
      push(cursor, end + 10, cur);
      var out = [];
      segs.forEach(function (s) {
        var last = out[out.length - 1];
        if (last && last[2] === s[2] && s[0] <= last[1]) { last[1] = Math.max(last[1], s[1]); }
        else out.push(s.slice());
      });
      return out;
    }

    function sdaPath() {
      var d = '';
      sdaSegs().forEach(function (s, i) {
        var y = top + (s[2] ? 0 : H);
        if (i === 0) d += 'M' + s[0] + ' ' + y;
        d += ' H' + s[0];
        d += ' V' + y;
        d += ' H' + s[1];
      });
      return d;
    }

    function mkSvg(hlId, pathD, band) {
      var s = '<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" xmlns="http://www.w3.org/2000/svg">';
      s += '<rect id="' + hlId + '" x="' + (padL - 10) + '" y="' + (top - 5) + '" width="' + (W * 1.35 + 20) +
           '" height="' + (H + 18) + '" rx="9" fill="rgba(78,107,255,.10)" stroke="var(--accent)" stroke-dasharray="5 3" opacity="0"/>';
      cells.forEach(function (c, i) {
        var x = starts[i] + c.w * W / 2, y = top + H + 16;
        s += '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="11" font-weight="700" fill="' +
             phaseColor(c) + '" font-family="JetBrainsMono, monospace">' + phaseName(c) + '</text>';
        var showSub = c.type === 'start' || c.type === 'stop' || c.type === 'nack' ||
                      i === 0 || (i > 0 && cells[i].seg && cells[i].seg !== cells[i - 1].seg);
        if (showSub) {
          var sub = phaseTitle(c, i).replace(/(起始条件 START|停止条件 STOP|应答 ACK|重复起始条件)/g, '');
          if (c.type === 'nack') sub = '读结束';
          if (c.type === 'start' && c.sr) sub = '重复起始';
          if (c.type === 'start' && !c.sr) sub = '起始';
          s += '<text x="' + x + '" y="' + (y + 13) + '" text-anchor="middle" font-size="8.5" fill="var(--muted)" font-family="WorkSans, sans-serif">' + sub + '</text>';
        }
      });
      s += '<path d="M' + (padL - 10) + ' ' + (top + H + 16) + ' H' + (end + 10) + '" stroke="var(--muted)" stroke-width="1" fill="none" opacity=".5"/>';
      if (band) s += band;
      s += '<path d="' + pathD + '" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linejoin="round"/>';
      s += '</svg>';
      return s;
    }

    function render() {
      buildCells();
      var sdaBand = '';
      cells.forEach(function (c, i) {
        if (c.type === 'bit' && c.v === 1) {
          sdaBand += '<rect x="' + (starts[i] + 2) + '" y="' + (top + H * 0.45) + '" width="' + (c.w * W - 4) + '" height="' + (H * 0.55) + '" fill="rgba(78,107,255,.05)"/>';
        }
      });
      sclEl.innerHTML = mkSvg('i2c-scl-hl', sclPath());
      sdaEl.innerHTML = mkSvg('i2c-sda-hl', sdaPath(), sdaBand);
      legendEl.innerHTML = '<span style="color:var(--muted);font-size:.8rem;align-self:center;">帧位序列：</span>' +
        cells.map(function (c, i) {
          return '<span style="font-family:JetBrainsMono,monospace;font-size:.72rem;padding:.18rem .5rem;border-radius:6px;background:var(--bg);border:1px solid var(--rule);color:' +
            phaseColor(c) + ';" title="' + phaseTitle(c, i) + '">' + phaseName(c) + '</span>';
        }).join('');
      if (step >= cells.length) step = -1;
      drawStep();
    }

    function statusText(c, i) {
      if (c.type === 'start') {
        if (c.sr) return '重复起始 Sr：SCL 为高时 SDA 先回到高再下降——不释放总线，通知从机接下来要切换为读方向。';
        return '起始条件：SCL 为高时，SDA 由高 → 低（下降沿），总线上所有从机开始监听地址。';
      }
      if (c.type === 'stop') return '停止条件：SCL 为高时，SDA 由低 → 高（上升沿），本次传输结束，总线释放（空闲高）。';
      if (c.type === 'nack') return '主机回 NACK：这是最后一个数据字节，主机不再拉低 SDA，从机停止发送并释放总线。';
      if (c.type === 'ack') {
        if (isAddrSeg(i)) return '应答 ACK：地址匹配的从机拉低 SDA，表示“我在，请继续”。';
        if (isRegSeg(i)) return '应答 ACK：从机确认收到寄存器地址。';
        return '应答 ACK：从机拉低 SDA，表示“数据已收到”。';
      }
      if (isAddrSeg(i)) return '第 ' + i + ' 位（' + (i <= 8 ? '首段地址' : '重复起始后的地址') + '）= ' + c.v + '。SDA 在 SCL 低电平期间就绪，SCL 高电平期间从机采样。';
      if (isRegSeg(i)) return '第 ' + i + ' 位：寄存器地址（0x00 的 bit ' + (7 - (i - 10)) + '）= ' + c.v + '，告诉从机要访问哪个存储单元。';
      return '第 ' + i + ' 位：数据（0x2A）= ' + c.v + '。SDA 在 SCL 低电平期间就绪，SCL 高电平期间' + (mode === 'read' ? '主机' : '从机') + '采样。';
    }

    function drawStep() {
      var st = $('#i2cStatus');
      if (!st) return;
      if (step < 0 || step >= cells.length) {
        if (sclHl()) { sclHl().setAttribute('opacity', 0); sdaHl().setAttribute('opacity', 0); }
        st.textContent = step >= cells.length
          ? '完成！帧以停止条件结束，总线恢复空闲（高电平）。可点击重置再看一遍。'
          : (mode === 'write'
              ? '点击播放，观察一次完整的 I2C 写操作时序（向 0x50 写入 0x2A）。'
              : '点击播放，观察一次完整的 I2C 读操作时序（从 0x50 寄存器 0x00 读出 0x2A，含重复起始与 NACK）。');
        return;
      }
      var c = cells[step];
      var x = starts[step] - 10, w = c.w * W + 20;
      var h1 = sclHl(), h2 = sdaHl();
      if (h1) {
        h1.setAttribute('x', x); h1.setAttribute('width', w); h1.setAttribute('opacity', 1);
        h2.setAttribute('x', x); h2.setAttribute('width', w); h2.setAttribute('opacity', 1);
      }
      st.textContent = statusText(c, step);
    }

    function sclHl() { return sclEl.querySelector('#i2c-scl-hl'); }
    function sdaHl() { return sdaEl.querySelector('#i2c-sda-hl'); }

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

    function play() {
      var btn = $('#i2cPlayBtn');
      if (playing) { stopTimer(); playing = false; if (btn) btn.textContent = '▶ 播放'; return; }
      playing = true;
      if (btn) btn.textContent = '⏸ 暂停';
      var speed = parseInt($('#i2cSpeed').value, 10) || 8;
      var interval = Math.max(50, Math.round(1000 / speed));
      if (step >= cells.length) step = -1;
      drawStep();
      timer = setInterval(function () {
        step++;
        if (step >= cells.length) {
          stopTimer(); playing = false;
          if (btn) btn.textContent = '▶ 播放';
        }
        drawStep();
      }, interval);
    }

    $('#i2cPlayBtn').addEventListener('click', play);
    $('#i2cResetBtn').addEventListener('click', function () {
      stopTimer(); playing = false; step = -1; drawStep();
      var btn = $('#i2cPlayBtn'); if (btn) btn.textContent = '▶ 播放';
    });
    $('#i2cSpeed').addEventListener('input', function () {
      if (playing) { stopTimer(); play(); }
    });
    function setMode(m) {
      if (mode === m) return;
      mode = m;
      stopTimer(); playing = false; step = -1;
      $('#i2cPlayBtn').textContent = '▶ 播放';
      $('#i2cModeWrite').classList.toggle('on', m === 'write');
      $('#i2cModeRead').classList.toggle('on', m === 'read');
      render();
    }
    $('#i2cModeWrite').addEventListener('click', function () { setMode('write'); });
    $('#i2cModeRead').addEventListener('click', function () { setMode('read'); });

    render();
  }
  buildI2C();

  /* =====================================================
     4. SPI 模式切换波形
  ===================================================== */
  function buildSPI() {
    var sclkEl = $('#spiSclk'), mosiEl = $('#spiMosi'), sampEl = $('#spiSample'), legendEl = $('#spiLegend');
    if (!sclkEl) return;

    var W = 52, H = 42, top = 8, padL = 18, n = 8;
    var BITS = [1, 0, 1, 1, 0, 0, 1, 0]; // 0b10110010
    var vbW = padL * 2 + n * W, vbH = 130;
    var MODE_TXT = [
      'Mode 0：CPOL=0（空闲低），CPHA=0 → 上升沿采样',
      'Mode 1：CPOL=0（空闲低），CPHA=1 → 下降沿采样',
      'Mode 2：CPOL=1（空闲高），CPHA=0 → 下降沿采样',
      'Mode 3：CPOL=1（空闲高），CPHA=1 → 上升沿采样'
    ];

    function render(mode) {
      var cpol = (mode >> 1) & 1, cpha = mode & 1;

      function sclkPath() {
        var d = 'M' + (padL - 10) + ' ' + (top + (cpol ? 0 : H));
        for (var i = 0; i < n; i++) {
          var s = padL + i * W, mid = s + W / 2, e = s + W;
          if (cpol === 0) {
            d += ' L' + s + ' ' + (top + H);
            d += ' L' + mid + ' ' + (top + H);
            d += ' L' + mid + ' ' + top;
            d += ' L' + e + ' ' + top;
            d += ' L' + e + ' ' + (top + H);
          } else {
            d += ' L' + s + ' ' + top;
            d += ' L' + mid + ' ' + top;
            d += ' L' + mid + ' ' + (top + H);
            d += ' L' + e + ' ' + (top + H);
            d += ' L' + e + ' ' + top;
          }
        }
        d += ' H' + (padL + n * W + 10);
        return d;
      }

      function mosiSegs() {
        var segs = [];
        for (var i = 0; i < n; i++) {
          var s = padL + i * W;
          var x0 = cpha === 0 ? s : s + W * 0.3;
          var x1 = cpha === 0 ? s + W * 0.62 : s + W * 1.18;
          segs.push([x0, x1, BITS[i]]);
        }
        return segs;
      }

      function mosiPath() {
        var segs = mosiSegs();
        var d = 'M' + (padL - 10) + ' ' + (top + H);
        var cursor = padL - 10, curY = top + H;
        segs.forEach(function (s) {
          var y = top + (s[2] ? 0 : H);
          if (s[0] > cursor) d += ' H' + s[0];
          if (curY !== y) { d += ' V' + y; curY = y; }
          d += ' H' + s[1];
          cursor = s[1];
        });
        d += ' H' + (padL + n * W + 10);
        return d;
      }

      function sampleMarks() {
        var g = '';
        for (var i = 0; i < n; i++) {
          var x = cpha === 0 ? (padL + i * W + W / 2) : (padL + (i + 1) * W);
          var y = top + H + 14;
          g += '<g><circle cx="' + x + '" cy="' + y + '" r="4.5" fill="rgba(15,163,160,.85)"/>';
          g += '<path d="M' + (x - 6) + ' ' + (y + 7) + ' L' + x + ' ' + (y + 14) + ' L' + (x + 6) + ' ' + (y + 7) + ' Z" fill="rgba(15,163,160,.85)"/>';
          g += '</g>';
        }
        return g;
      }

      function mkSvg(pathD, extra) {
        return '<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M' + (padL - 10) + ' ' + (top + H + 14) + ' H' + (padL + n * W + 10) + '" stroke="var(--muted)" stroke-width="1" fill="none" opacity=".5"/>' +
          '<path d="' + pathD + '" stroke="var(--ink)" stroke-width="2.2" fill="none" stroke-linejoin="round"/>' +
          extra + '</svg>';
      }

      sclkEl.innerHTML = mkSvg(sclkPath());
      mosiEl.innerHTML = mkSvg(mosiPath());
      sampEl.innerHTML = mkSvg('M0 0', sampleMarks());

      var labels = '';
      for (var i = 0; i < n; i++) {
        labels += '<span style="font-family:JetBrainsMono,monospace;font-size:.75rem;padding:.18rem .5rem;border-radius:6px;background:var(--bg);border:1px solid var(--rule);">D' + i + ' = ' + BITS[i] + '</span>';
      }
      legendEl.innerHTML = labels + '<span style="color:var(--muted);font-size:.82rem;">示例字节 0xB2（MSB 先发）· ' + MODE_TXT[mode] + '</span>';
    }

    render(0);
    $all('[data-spi-mode]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        render(parseInt(btn.getAttribute('data-spi-mode'), 10));
      });
    });
  }
  buildSPI();

  /* =====================================================
     4.5 CAN 仲裁动画播放器
  ===================================================== */
  function buildArb() {
    var rowA = $('#arbRowA'), rowB = $('#arbRowB'), rowBus = $('#arbRowBus'), legend = $('#arbLegend');
    if (!rowA || !rowB || !rowBus) return;

    var A = [1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]; // 0x520
    var B = [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0]; // 0x120
    var W = 46, H = 32, top = 12, padL = 16, n = 11;
    var totalW = padL * 2 + n * W;

    // 找出 A 在哪一位输（A 发 1 而 B 发 0）
    var loserStep = -1;
    for (var i = 0; i < n; i++) { if (A[i] !== B[i]) { loserStep = i; break; } }
    var bus = [];
    for (var j = 0; j < n; j++) { bus.push(j < loserStep ? (A[j] & B[j]) : B[j]); }

    function mkRow(prefix) {
      var s = '<svg viewBox="0 0 ' + totalW + ' 64" xmlns="http://www.w3.org/2000/svg">';
      for (var i = 0; i < n; i++) {
        var x = padL + i * W;
        s += '<rect id="' + prefix + '-c' + i + '" x="' + x + '" y="' + top + '" width="' + (W - 5) + '" height="' + H + '" rx="6" fill="rgba(23,30,46,.05)" stroke="var(--rule)"/>';
        s += '<text id="' + prefix + '-t' + i + '" x="' + (x + (W - 5) / 2) + '" y="' + (top + H / 2 + 4.5) + '" text-anchor="middle" font-size="13" font-weight="700" fill="var(--ink)" font-family="JetBrainsMono, monospace"></text>';
      }
      s += '</svg>';
      return s;
    }
    rowA.innerHTML = mkRow('arb-a');
    rowB.innerHTML = mkRow('arb-b');
    rowBus.innerHTML = mkRow('arb-bu');

    function setBits(prefix, vals) {
      for (var i = 0; i < n; i++) {
        var t = document.getElementById(prefix + '-t' + i);
        if (t) t.textContent = vals[i];
      }
    }
    setBits('arb-a', A);
    setBits('arb-b', B);
    setBits('arb-bu', bus);

    legend.innerHTML = '<span style="color:var(--muted);font-size:.8rem;">0 = 显性（优先级高，覆盖 1）· 1 = 隐性 · 点击"播放仲裁过程"逐位观察谁胜谁负</span>';

    var timer = null, step = -1, playing = false;

    function resetCells() {
      for (var i = 0; i < n; i++) {
        ['arb-a', 'arb-b', 'arb-bu'].forEach(function (p) {
          var c = document.getElementById(p + '-c' + i), t = document.getElementById(p + '-t' + i);
          if (c) { c.setAttribute('fill', 'rgba(23,30,46,.05)'); c.setAttribute('stroke', 'var(--rule)'); c.setAttribute('stroke-width', '1'); }
          if (t) { t.setAttribute('fill', 'var(--ink)'); t.setAttribute('opacity', '1'); }
        });
      }
      // A 退出后位置置灰（始终显示）
      for (var k = loserStep; k < n; k++) {
        var c = document.getElementById('arb-a-c' + k), t = document.getElementById('arb-a-t' + k);
        if (c) { c.setAttribute('fill', 'rgba(23,30,46,.02)'); }
        if (t) { t.setAttribute('opacity', '.4'); }
      }
    }

    function draw() {
      var st = $('#arbStatus');
      if (!st) return;
      resetCells();
      if (step < 0) { st.textContent = '两个节点同时发送：A 的 ID=0x520，B 的 ID=0x120。点击播放，观察逐位仲裁。'; return; }
      if (step >= n) {
        st.textContent = '仲裁完成！B（ID=0x120）赢得总线，A 将在总线空闲后自动重发自己的帧——全程无损，赢家发送未被中断。';
        return;
      }
      ['arb-a', 'arb-b', 'arb-bu'].forEach(function (p) {
        var c = document.getElementById(p + '-c' + step);
        if (c) { c.setAttribute('stroke', 'var(--accent)'); c.setAttribute('stroke-width', '2.5'); c.setAttribute('fill', 'rgba(78,107,255,.10)'); }
      });
      if (step === loserStep) {
        var loseC = document.getElementById('arb-a-c' + step), loseT = document.getElementById('arb-a-t' + step);
        if (loseC) { loseC.setAttribute('stroke', '#C53030'); loseC.setAttribute('fill', 'rgba(239,68,68,.12)'); }
        if (loseT) { loseT.setAttribute('fill', '#C53030'); }
        var winC = document.getElementById('arb-b-c' + step), winT = document.getElementById('arb-b-t' + step);
        if (winC) { winC.setAttribute('stroke', '#0B7D7B'); winC.setAttribute('fill', 'rgba(15,163,160,.12)'); }
        if (winT) { winT.setAttribute('fill', '#0B7D7B'); }
        st.textContent = '第 ' + step + ' 位（最高位）：A 发 1（隐性）、B 发 0（显性）→ 总线 = 0。A 发出 1 却读回 0 → 仲裁失败，立即转为接收；B 赢得总线！';
      } else if (step < loserStep) {
        st.textContent = '第 ' + step + ' 位：A=' + A[step] + '、B=' + B[step] + ' 完全相同，总线=' + bus[step] + '，继续比较下一位…';
      } else {
        st.textContent = 'B 独占总线继续发送第 ' + step + ' 位（' + B[step] + '）… A 已退出（灰色），不再影响总线。';
      }
    }

    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function play() {
      var btn = $('#arbPlayBtn');
      if (playing) { stopTimer(); playing = false; if (btn) btn.textContent = '▶ 播放仲裁过程'; return; }
      playing = true;
      if (btn) btn.textContent = '⏸ 暂停';
      if (step >= n) step = -1;
      draw();
      timer = setInterval(function () {
        step++;
        if (step >= n) { stopTimer(); playing = false; if (btn) btn.textContent = '▶ 播放仲裁过程'; }
        draw();
      }, 950);
    }
    $('#arbPlayBtn').addEventListener('click', play);
    $('#arbResetBtn').addEventListener('click', function () {
      stopTimer(); playing = false; step = -1; draw();
      var btn = $('#arbPlayBtn'); if (btn) btn.textContent = '▶ 播放仲裁过程';
    });
    draw();
  }
  buildArb();

  /* =====================================================
     5. CAN 帧字段点击互动
  ===================================================== */
  $all('.frame-field').forEach(function (f) {
    f.addEventListener('click', function () {
      var name = f.getAttribute('data-field');
      $all('.frame-field').forEach(function (x) { x.style.filter = x === f ? 'brightness(1.18)' : ''; });
      $all('.frame-desc').forEach(function (d) { d.classList.remove('on'); });
      var desc = $('#desc-' + name);
      if (desc) desc.classList.add('on');
    });
  });

  /* =====================================================
     6. 测验系统（15 题）
  ===================================================== */
  var QUIZ = [
    { tag: 'UART', color: 'var(--c-uart)',
      q: 'UART 采用 8-N-1 格式（8 数据位、无校验、1 停止位）时，传输 1 个字节实际在线上占多少个位时间？',
      opts: ['8 位', '9 位', '10 位', '11 位'],
      a: 2,
      e: '8-N-1 = 1 个起始位 + 8 个数据位 + 1 个停止位 = 10 位。所以波特率 115200 时有效数据率约 9216 B/s。' },
    { tag: 'UART', color: 'var(--c-uart)',
      q: 'UART 通信时收发双方最重要的一致条件是？',
      opts: ['必须共用同一时钟线', '波特率必须一致', '必须接终端电阻', '必须使用相同的 7 位地址'],
      a: 1,
      e: 'UART 是异步协议，没有时钟线，靠双方各自时钟在约定的波特率上采样。波特率不一致会导致采样点错位、数据乱码。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 总线空闲时（无任何传输），SDA 和 SCL 的电平是？',
      opts: ['都为低电平', 'SDA 高、SCL 低', '都为高电平', '不确定，取决于上拉电阻大小'],
      a: 2,
      e: 'I2C 使用开漏输出 + 上拉电阻，空闲时总线被上拉到高电平（1）。任何设备拉低即产生显性的 0。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 的起始条件（START）是？',
      opts: ['SCL 为高时，SDA 由高变低', 'SCL 为高时，SDA 由低变高', 'SCL 为低时，SDA 由高变低', 'SDA 与 SCL 同时变低'],
      a: 0,
      e: '起始条件：SCL 保持高电平时 SDA 产生下降沿。停止条件（STOP）正好相反：SCL 高时 SDA 产生上升沿。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: '从机地址为 0x27（7 位），主机要执行“写”操作，发送的完整首字节是？',
      opts: ['0x27', '0x4E', '0x13', '0x9C'],
      a: 1,
      e: '8 位 = 7 位地址左移 1 位 + R/W 位。0x27 = 0100111b，左移得 1001110b，写位为 0，即 10011100b = 0x4E。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 读操作中，主机读取最后一个数据字节后应回什么，以通知从机停止发送？',
      opts: ['ACK', 'NACK（不发应答）', '再发一个 START', '拉高 SCL'],
      a: 1,
      e: '读最后一个字节必须回 NACK：从机看到 NACK 就知道数据读完，释放总线。若误回 ACK，从机会继续发送下一字节。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 多主仲裁时，两个主机同时在总线上发送，谁赢得总线？',
      opts: ['先发 1 的主机', '先发 0 的主机', '地址更大的主机', '随机决定'],
      a: 1,
      e: 'I2C 是“线与”逻辑：0 覆盖 1。发出 1 却读回 0 的主机判定自己失败并退出，因此先发 0 的主机获胜，仲裁不丢数据。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: '关于 I2C 的“时钟拉伸（Clock Stretching）”，下列说法正确的是？',
      opts: ['主机主动拉低 SCL 以降低速率', '慢速从机把 SCL 拉低，让主机暂停等待', '只有高速模式才支持', '时钟拉伸会破坏数据'],
      a: 1,
      e: '时钟拉伸是慢速从机在未就绪时主动拉低 SCL，主机检测到 SCL 为低就会暂停时钟，直到从机释放。这是 I2C 处理速率差异的机制。' },
    { tag: 'SPI', color: 'var(--c-spi)',
      q: 'SPI 默认最常见的 Mode 0 对应 CPOL 和 CPHA 分别是？采样发生在哪个沿？',
      opts: ['CPOL=0，CPHA=0，上升沿采样', 'CPOL=1，CPHA=0，下降沿采样', 'CPOL=0，CPHA=1，下降沿采样', 'CPOL=1，CPHA=1，上升沿采样'],
      a: 0,
      e: 'Mode 0 = 时钟空闲低（CPOL=0）+ 第一个沿采样（CPHA=0）→ 上升沿采样。大多数 SPI 器件默认 Mode 0。' },
    { tag: 'SPI', color: 'var(--c-spi)',
      q: '一个 SPI 主机要连接 3 个独立从机，最少需要多少根信号线（不计电源地）？',
      opts: ['5 根', '6 根', '7 根', '8 根'],
      a: 1,
      e: '共享 SCLK + MOSI + MISO 共 3 根，另加每个从机一根 CS = 3 根，合计 6 根（N 从机 = N+3）。' },
    { tag: 'SPI', color: 'var(--c-spi)',
      q: '与 I2C 相比，SPI 的主要优势是？',
      opts: ['引脚更少', '支持多主多从', '全双工且速度更快', '有标准应答机制'],
      a: 2,
      e: 'SPI 是同步全双工（MOSI 发同时 MISO 收），速度可达上百 Mbps；但它引脚多、无 ACK、一般一主多从。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN 总线上，逻辑“显性位（Dominant）”对应的电平与逻辑值分别是？',
      opts: ['CAN_H 与 CAN_L 差分约 2V，逻辑 0', 'CAN_H 与 CAN_L 差分约 0V，逻辑 0', '差分约 2V，逻辑 1', '单端高电平，逻辑 1'],
      a: 0,
      e: '显性位（差分约 2V）= 逻辑 0，且显性位能覆盖隐性位（逻辑 1，差分约 0V）。这正是 CAN 仲裁的物理基础。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN 总线两端的终端电阻标准阻值与数量是？',
      opts: ['每个节点各 120Ω', '总线两端各 120Ω', '两端各 60Ω', '只在一端接 60Ω'],
      a: 1,
      e: '总线最远两端各接 1 个 120Ω（并联等效 60Ω），用于吸收反射。中间节点不接，否则会拉低差分电平。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN 2.0A 标准数据帧的标识符（ID）长度是？',
      opts: ['7 位', '11 位', '29 位', '32 位'],
      a: 1,
      e: '标准帧（CAN 2.0A）ID 为 11 位；扩展帧（CAN 2.0B）ID 为 29 位（11 + 18 位扩展）。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: '两个 CAN 节点同时发送不同 ID 的帧，仲裁后谁继续发送？',
      opts: ['ID 大的节点', 'ID 小的节点', '先开始发送的节点', '两者都被中止，重新随机'],
      a: 1,
      e: 'CAN 逐位仲裁：显性 0 覆盖隐性 1，谁先发 0 谁赢。ID 越小，前面的 0 越多，越早获胜 → ID 小 = 优先级高。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: '关于 CAN 的错误处理与容错，下列说法错误的是？',
      opts: ['有 CRC、位、填充、形式、应答五类错误检测', '出错节点发送错误帧让所有人丢弃本帧', '节点严重出错会进入 Bus-off 自动脱离总线', 'CAN 没有错误检测机制，靠上层软件保证'],
      a: 3,
      e: 'CAN 自带完整的五类错误检测和错误状态机（主动/被动/Bus-off），无需上层软件参与，这是它可靠性的核心。' },
    { tag: 'UART', color: 'var(--c-uart)',
      q: 'UART 帧的起始位是什么电平？接收方靠它完成什么？',
      opts: ['高电平，靠它同步波特率', '低电平（下降沿），靠它识别"数据开始"并同步采样', '任意电平，无所谓', '起始位其实就是第 0 位数据'],
      a: 1,
      e: '线路空闲为高，起始位是低电平的下降沿。接收方在下降沿开始计时，随后按波特率在每位中点采样。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 10 位地址的扩展前缀是？',
      opts: ['11110xx', '0000xxx', '1110xxx', '1010xxx'],
      a: 0,
      e: '10 位地址以 11110 为前缀：首字节 = 11110 + 地址高 2 位 + R/W，随后再发剩余 8 位地址。7 位与 10 位地址因此互不冲突。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 标准/快速/快速+/高速四种模式对应的速率分别是？',
      opts: ['100k / 400k / 1M / 3.4M bps', '1M / 2M / 4M / 8M bps', '10k / 100k / 1M / 10M bps', '100k / 500k / 1M / 2M bps'],
      a: 0,
      e: 'SM=100kHz，FM=400kHz，FM+=1MHz，HS=3.4MHz。高速模式下还需要电流源上拉和主机码（Master Code）握手。' },
    { tag: 'I2C', color: 'var(--c-i2c)',
      q: 'I2C 读操作中，"重复起始（Repeated START）"的主要作用是？',
      opts: ['加快传输速度', '在不释放总线的前提下切换读写方向', '让从机复位', '代替 ACK'],
      a: 1,
      e: '重复起始让主机在读完寄存器地址后继续发"地址+R"而不释放总线，避免其它主机插入，保证本次读操作原子完成。' },
    { tag: 'SPI', color: 'var(--c-spi)',
      q: 'SPI 菊花链（Daisy Chain）拓扑的主要好处是？',
      opts: ['提高通信速度', '减少主机 CS 引脚占用（N 个从机只占 1 根）', '支持多主机', '自动纠正数据错误'],
      a: 1,
      e: '菊花链把从机的 DOUT 接到下一个从机的 DIN，数据像移位寄存器一样逐级传递，主机只需 1 根 CS 即可控制 N 个从机，代价是延迟增加。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN 的位填充（Bit Stuffing）规则是？',
      opts: ['每发 8 个数据位插入 1 个校验位', '连续 5 个相同位后插入 1 个反相位', '每帧固定插入 3 个填充位', '数据全为 0 时插入 1 个 1'],
      a: 1,
      e: '发送方在 SOF 到 CRC 场之间，若连续出现 5 个相同位，就插入 1 个反相位。接收方若连续看到 6 个相同位则判定填充错误。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: '某个 CAN 节点检测到错误后发出"错误帧"，它的作用是？',
      opts: ['只通知发送方重发', '破坏当前帧，让所有节点都丢弃它', '提高总线优先级', '触发终端电阻切换'],
      a: 1,
      e: '错误帧（主动时为 6 个显性位）会覆盖当前帧的剩余部分，使所有节点都检测到错误并丢弃该帧，发送节点随后自动重发。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN 节点进入 Bus-off（总线关闭）状态后会发生什么？',
      opts: ['自动降低波特率重试', '完全脱离总线，停止一切收发', '变为只读模式', '升级为错误主动状态'],
      a: 1,
      e: '当 TEC>255 时节点进入 Bus-off，完全脱离总线（输出高阻），需等待 128 次总线空闲或上层主动复位才能恢复，防止坏节点拖垮整条总线。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN FD 相比 CAN 2.0 最重要的两个改进是？',
      opts: ['增加校验位并提高波特率', '数据场最大 64 字节 + 数据段速率大幅提升', '增加 29 位 ID 并支持多主机', '减少帧长度并降低延迟'],
      a: 1,
      e: 'CAN FD 把数据场从 8 字节扩到 64 字节，并让数据段速率提升到数 Mbps（BRS 位切换），同时保留与 CAN 2.0 兼容的仲裁机制。' },
    { tag: 'CAN', color: 'var(--c-can)',
      q: 'CAN 位时间的采样点通常设计在位的什么位置？',
      opts: ['位的正中间 50%', '75%~87% 处（偏后）', '位的起始 10% 处', '100% 处（下一位起点）'],
      a: 1,
      e: '采样点放在位的 75%~87%，是为了留出足够的传播延迟余量（Prop+PS1 吸收线缆延迟），又能在位结束时完成同步。所有节点采样点越接近，通信越可靠。' }
  ];

  var qIdx = 0, qScore = 0, qAnswered = false;
  var qStates = new Array(QUIZ.length).fill(null);
  var qBody = $('#qBody'), qActions = $('#qActions'), qDone = $('#qDone');
  var qid = $('#qid'), qScoreEl = $('#qScore'), qFill = $('#qFill'), qTag = $('#qTag');

  function renderQuestion() {
    qAnswered = false;
    var item = QUIZ[qIdx];
    qid.textContent = '第 ' + (qIdx + 1) + ' / ' + QUIZ.length + ' 题';
    qScoreEl.textContent = '得分：' + qScore + ' / ' + qIdx;
    qFill.style.width = (qIdx / QUIZ.length * 100) + '%';
    qTag.innerHTML = '<span class="pill" style="background:' + item.color + '1a;color:' + item.color + ';">' + item.tag + '</span>';

    qBody.innerHTML = '<div class="qtitle">' + item.q + '</div><div class="qopts">' +
      item.opts.map(function (o, i) {
        return '<div class="qopt" data-i="' + i + '"><span class="key">' + String.fromCharCode(65 + i) + '</span><span>' + o + '</span></div>';
      }).join('') + '</div><div class="qexp" id="qExp"></div>';

    qActions.innerHTML = (qIdx > 0 ? '<button class="btn btn-ghost" id="qPrev">← 上一题</button>' : '') +
      '<button class="btn btn-primary" id="qNext" disabled>下一题 →</button>';

    // 回看已答题目时恢复状态
    if (qStates[qIdx]) {
      restoreAnswered(item, qStates[qIdx]);
    }

    $all('.qopt', qBody).forEach(function (opt) {
      opt.addEventListener('click', function () { choose(opt); });
    });
    var prev = $('#qPrev');
    if (prev) prev.addEventListener('click', function () { qIdx--; renderQuestion(); });
    $('#qNext').addEventListener('click', function () {
      if (qIdx + 1 >= QUIZ.length) showDone();
      else { qIdx++; renderQuestion(); }
    });
  }

  function restoreAnswered(item, state) {
    qAnswered = true;
    $all('.qopt', qBody).forEach(function (o) {
      var i = parseInt(o.getAttribute('data-i'), 10);
      if (i === item.a) o.classList.add('correct');
      else if (i === state.chosen) o.classList.add('wrong');
      else o.classList.add('dim');
      o.style.pointerEvents = 'none';
    });
    var exp = $('#qExp');
    exp.classList.add('on');
    exp.innerHTML = '<strong>' + (state.correct ? '✅ 回答正确' : '❌ 回答错误') + '</strong><br>' + item.e;
    $('#qNext').disabled = false;
    qScoreEl.textContent = '得分：' + qScore + ' / ' + (qIdx + 1);
  }

  function choose(opt) {
    if (qAnswered) return;
    qAnswered = true;
    var item = QUIZ[qIdx];
    var chosen = parseInt(opt.getAttribute('data-i'), 10);
    var isCorrect = chosen === item.a;

    $all('.qopt', qBody).forEach(function (o) {
      var i = parseInt(o.getAttribute('data-i'), 10);
      if (i === item.a) o.classList.add('correct');
      else if (i === chosen) o.classList.add('wrong');
      else o.classList.add('dim');
      o.style.pointerEvents = 'none';
    });

    if (isCorrect) qScore++;
    qStates[qIdx] = { chosen: chosen, correct: isCorrect };
    qScoreEl.textContent = '得分：' + qScore + ' / ' + (qIdx + 1);

    var exp = $('#qExp');
    exp.classList.add('on');
    exp.innerHTML = '<strong>' + (isCorrect ? '✅ 回答正确' : '❌ 回答错误') + '</strong><br>' + item.e;

    $('#qNext').disabled = false;
  }

  function showDone() {
    qBody.innerHTML = '';
    qActions.innerHTML = '';
    qFill.style.width = '100%';
    qid.textContent = '测验完成';
    qScoreEl.textContent = '得分：' + qScore + ' / ' + QUIZ.length;
    qDone.classList.add('on');
    var pct = Math.round(qScore / QUIZ.length * 100);
    $('#scoreNum').textContent = pct + '%';
    var arc = $('#scoreArc');
    setTimeout(function () { arc.setAttribute('stroke-dashoffset', 326.7 * (1 - qScore / QUIZ.length)); }, 120);
    var txt;
    if (pct === 100) txt = '满分！你是总线大师 🏆';
    else if (pct >= 80) txt = '非常优秀！重点复习 I2C 与 CAN 的细节即可。';
    else if (pct >= 60) txt = '不错！建议回看各章“一分钟总结”再战一次。';
    else if (pct >= 40) txt = '基础还不牢，建议从头系统学习一遍。';
    else txt = '别灰心！从 UART 入门章节开始，一步步来。';
    $('#scoreTxt').textContent = txt;

    // ---- 章节统计 ----
    var byTag = { UART: 0, I2C: 0, SPI: 0, CAN: 0 };
    var tagTotal = { UART: 0, I2C: 0, SPI: 0, CAN: 0 };
    QUIZ.forEach(function (item, i) {
      tagTotal[item.tag]++;
      if (qStates[i] && qStates[i].correct) byTag[item.tag]++;
    });
    $('#qSummary').innerHTML = Object.keys(tagTotal).map(function (t) {
      return '<div class="qs"><b>' + byTag[t] + ' / ' + tagTotal[t] + '</b><span>' + t + '</span></div>';
    }).join('');

    // ---- 错题回顾（点击跳回原题看解析）----
    var wrongIdx = [];
    QUIZ.forEach(function (item, i) { if (qStates[i] && !qStates[i].correct) wrongIdx.push(i); });
    var revHtml;
    if (wrongIdx.length === 0) {
      revHtml = '<div class="rev-t">错题回顾</div><div class="rev-all-ok">🎯 全部答对，太棒了！</div>';
    } else {
      revHtml = '<div class="rev-t">错题回顾（点击跳回原题复习解析）</div>' + wrongIdx.map(function (i) {
        return '<div class="rev-item" data-q="' + i + '">❌ 第 ' + (i + 1) + ' 题 · ' + QUIZ[i].tag + ' · ' + QUIZ[i].q + '</div>';
      }).join('');
    }
    $('#qReview').innerHTML = revHtml;
    $all('.rev-item').forEach(function (el) {
      el.addEventListener('click', function () {
        qIdx = parseInt(el.getAttribute('data-q'), 10);
        qDone.classList.remove('on');
        renderQuestion();
        var box = $('#quizBox');
        if (box) window.scrollTo({ top: box.offsetTop - 90, behavior: 'smooth' });
      });
    });
  }

  $('#retryBtn').addEventListener('click', function () {
    qIdx = 0; qScore = 0;
    qStates = new Array(QUIZ.length).fill(null);
    qDone.classList.remove('on');
    renderQuestion();
  });

  renderQuestion();
})();
