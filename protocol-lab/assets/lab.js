// ============================================================
// ProtocolLab —— 波形实验室 + CAN 位时序计算器 + 故障诊断
// ============================================================
(function () {
  'use strict';
  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }

  var MONO = 'JetBrainsMono, monospace';
  var CUR = { proto: 'UART' };

  /* ================= 通用波形绘制工具 ================= */
  // segs: [{x0,x1,lv}] 电平段（lv:0/1），绘制方波
  function segPath(segs, top, H, padL, padR) {
    var d = '', curY = null;
    var start = padL, end = padL + padR;
    segs.forEach(function (s) {
      var y = top + (s.lv ? 0 : H);
      if (curY === null) { d = 'M' + Math.max(s.x0, start) + ' ' + y; }
      else {
        d += ' H' + s.x0;
        if (curY !== y) d += ' V' + y;
      }
      curY = y;
      d += ' H' + s.x1;
    });
    return d;
  }

  function svgWrap(w, h, inner) {
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  function hex2byte(h) {
    var v = parseInt(String(h).replace(/^0x/i, ''), 16);
    if (isNaN(v)) v = 0;
    return v & 0xFF;
  }

  // 逐位解读面板：rows = [ [chip, chip, ...], ... ]；chip = {t:标签, d:说明, cls:颜色类}
  function showDecode(rows) {
    var el = $('#scopeDecode');
    if (!el) return;
    el.innerHTML = '<div class="dc-title">逐位解读（自左向右）</div>' + rows.map(function (row) {
      return '<div class="dc-row">' + row.map(function (c) {
        return '<span class="dc-chip ' + (c.cls || 'dc-c1') + '" title="' + (c.d || '') + '"><b>' + c.t + '</b> ' + (c.d || '') + '</span>';
      }).join('') + '</div>';
    }).join('');
  }

  /* ================= ① UART 波形 ================= */
  function genUart() {
    var data = hex2byte($('#uData').value);
    var baud = parseInt($('#uBaud').value, 10) || 115200;
    var parity = $('#uParity').value;
    var stop = parseInt($('#uStop').value, 10) || 1;

    // 位序列: start(0), data LSB first, parity, stop
    var bits = [];
    for (var i = 0; i < 8; i++) bits.push((data >> i) & 1);
    if (parity !== 'none') {
      var ones = bits.filter(function (b) { return b === 1; }).length;
      bits.push(parity === 'even' ? (ones % 2 === 0 ? 0 : 1) : (ones % 2 === 1 ? 0 : 1));
    }
    for (var s = 0; s < stop; s++) bits.push(1);

    var W = 44, top = 24, H = 64, padL = 20;
    var cells = [{ t: 'idle', w: 2 }];       // 前导空闲
    cells.push({ t: 'start', w: 1 });
    for (var d = 0; d < 8; d++) cells.push({ t: 'data', i: d, w: 1 });
    if (parity !== 'none') cells.push({ t: 'par', w: 1 });
    for (var st = 0; st < stop; st++) cells.push({ t: 'stop', w: 1 });
    cells.push({ t: 'idle', w: 3 });          // 尾部空闲

    var x = padL, starts = [];
    cells.forEach(function (c) { starts.push(x); x += c.w * W; });
    var totalW = x + 10;

    // SDA 电平段
    var segs = [], cur = 1, cursor = 4;
    cells.forEach(function (c, i) {
      var s = starts[i], e = s + c.w * W;
      var val = 1;
      if (c.t === 'start') val = 0;
      else if (c.t === 'data') val = bits[c.i];
      else if (c.t === 'par') val = bits[8];
      else if (c.t === 'stop') val = 1;
      if (val !== cur) { segs.push({ x0: cursor, x1: s, lv: cur }); segs.push({ x0: s, x1: s, lv: val }); cur = val; }
      segs.push({ x0: cursor < s ? s : cursor, x1: e, lv: val });
      cursor = e;
    });
    segs.push({ x0: cursor, x1: totalW - 6, lv: cur });

    var inner = '';
    // 位标签
    cells.forEach(function (c, i) {
      var cx = starts[i] + c.w * W / 2;
      var txt, color = 'var(--muted)';
      if (c.t === 'idle') { txt = '空闲(1)'; }
      else if (c.t === 'start') { txt = 'ST'; color = 'var(--c-can)'; }
      else if (c.t === 'data') { txt = 'D' + c.i + '=' + bits[c.i]; color = 'var(--ink)'; }
      else if (c.t === 'par') { txt = 'P=' + bits[8]; color = 'var(--c-spi)'; }
      else { txt = 'SP'; color = 'var(--c-i2c)'; }
      inner += '<text x="' + cx + '" y="' + (top + H + 16) + '" text-anchor="middle" class="bit-tag" fill="' + color + '">' + txt + '</text>';
    });
    inner += '<path d="' + segPath(segs, top, H, padL, totalW - padL) + '" class="sig-b"/>';
    inner += '<line x1="8" y1="' + (top + H + 30) + '" x2="' + (totalW - 6) + '" y2="' + (top + H + 30) + '" stroke="var(--rule)"/>';

    // 时间标注
    var usPerBit = Math.round(1e6 / baud);
    inner += '<text x="' + (totalW / 2) + '" y="' + (top + H + 46) + '" text-anchor="middle" class="lbl">每 bit = ' + usPerBit + ' µs（波特率 ' + baud + '）· 帧共 ' + cells.length + ' 个位时间 · 有效数据率 ' + Math.round(baud / 10) + ' B/s</text>';

    $('#scopeSvg').innerHTML = svgWrap(totalW, top + H + 62, inner);
    var pn = parity === 'none' ? 'N' : (parity === 'even' ? 'E' : 'O');
    $('#scopeInfo').innerHTML = 'UART ' + baud + ' bps · 8-' + pn + '-' + stop +
      ' · 发送字节 <b>0x' + ('0' + data.toString(16).toUpperCase()).slice(-2) + '</b>（' +
      bits.slice(0, 8).join('') + '，LSB 先发）';

    // 逐位解读
    var dchips = [{ t: 'ST', d: '起始位 = 0（下降沿唤醒）', cls: 'dc-c4' }];
    for (var di = 0; di < 8; di++) dchips.push({ t: 'D' + di, d: '= ' + bits[di], cls: 'dc-c1' });
    if (parity !== 'none') dchips.push({ t: 'P', d: '校验 = ' + bits[8], cls: 'dc-c3' });
    for (var si = 0; si < stop; si++) dchips.push({ t: 'SP', d: '停止位 = 1（回空闲）', cls: 'dc-c2' });
    showDecode([dchips]);
  }

  /* ================= ② I2C 波形（读/写） ================= */
  function genI2c() {
    var addr7 = hex2byte($('#iAddr').value);
    var data = hex2byte($('#iData').value);
    var reg = hex2byte($('#iReg').value);
    var rate = parseInt($('#iRate').value, 10) || 400;
    var op = ($('#iOp') || { value: 'write' }).value;
    var W = 40, H = 46, top = 20, padL = 16;

    function toBits8(v) { var a = []; for (var i = 7; i >= 0; i--) a.push((v >> i) & 1); return a; }
    var addrWBits = toBits8((addr7 << 1) | 0);   // 地址+W
    var addrRBits = toBits8((addr7 << 1) | 1);   // 地址+R
    var regBits = toBits8(reg);
    var dataBits = toBits8(data);

    var cells = [];
    if (op === 'write') {
      cells.push({ t: 'start', sr: false, w: 1.35 });
      addrWBits.forEach(function (b) { cells.push({ t: 'bit', v: b, seg: 'addr1', w: 1 }); });
      cells.push({ t: 'ack', w: 1 });
      dataBits.forEach(function (b) { cells.push({ t: 'bit', v: b, seg: 'data', w: 1 }); });
      cells.push({ t: 'ack', w: 1 });
      cells.push({ t: 'stop', w: 1.35 });
    } else {
      cells.push({ t: 'start', sr: false, w: 1.35 });
      addrWBits.forEach(function (b) { cells.push({ t: 'bit', v: b, seg: 'addr1', w: 1 }); });
      cells.push({ t: 'ack', w: 1 });
      regBits.forEach(function (b) { cells.push({ t: 'bit', v: b, seg: 'reg', w: 1 }); });
      cells.push({ t: 'ack', w: 1 });
      cells.push({ t: 'start', sr: true, w: 1.35 });   // 重复起始
      addrRBits.forEach(function (b) { cells.push({ t: 'bit', v: b, seg: 'addr2', w: 1 }); });
      cells.push({ t: 'ack', w: 1 });
      dataBits.forEach(function (b) { cells.push({ t: 'bit', v: b, seg: 'data', w: 1 }); });
      cells.push({ t: 'nack', w: 1 });
      cells.push({ t: 'stop', w: 1.35 });
    }

    var x = padL, starts = [];
    cells.forEach(function (c) { starts.push(x); x += c.w * W; });
    var totalW = x + 10;

    function cname(c) {
      if (c.t === 'start') return c.sr ? 'Sr' : 'S';
      if (c.t === 'stop') return 'P';
      if (c.t === 'ack') return 'ACK';
      if (c.t === 'nack') return 'NACK';
      return c.v ? '1' : '0';
    }
    function ccolor(c) {
      if (c.t === 'start') return '#8B5CF6';
      if (c.t === 'stop') return '#EF4444';
      if (c.t === 'ack') return '#0FA3A0';
      if (c.t === 'nack') return '#C53030';
      return '#4E6BFF';
    }

    // SCL
    function sclD() {
      var d = 'M' + (padL - 8) + ' ' + top;
      cells.forEach(function (c, i) {
        var s = starts[i], e = s + c.w * W;
        if (c.t === 'start' || c.t === 'stop') d += ' H' + e;
        else {
          d += ' L' + s + ' ' + (top + H) + ' H' + (s + c.w * W / 2) + ' L' + (s + c.w * W / 2) + ' ' + top + ' H' + e;
        }
      });
      return d + ' H' + (totalW - 6);
    }
    // SDA 段
    var sda = [], cu = 1, cursor = padL - 8;
    cells.forEach(function (c, i) {
      var s = starts[i], e = s + c.w * W;
      if (c.t === 'start') {
        if (c.sr) {
          sda.push({ x0: cursor, x1: s, lv: cu });
          sda.push({ x0: s, x1: s + c.w * W * 0.35, lv: 1 });
          sda.push({ x0: s + c.w * W * 0.35, x1: e, lv: 0 });
        } else {
          sda.push({ x0: cursor, x1: s, lv: cu });
          sda.push({ x0: s, x1: e, lv: 0 });
        }
        cu = 0; cursor = e;
      } else if (c.t === 'stop') {
        sda.push({ x0: cursor, x1: s, lv: cu });
        sda.push({ x0: s, x1: e, lv: 1 }); cu = 1; cursor = e;
      } else if (c.t === 'ack') {
        sda.push({ x0: cursor, x1: s, lv: cu });
        sda.push({ x0: s, x1: e, lv: 0 }); cu = 0; cursor = e;
      } else if (c.t === 'nack') {
        sda.push({ x0: cursor, x1: s, lv: cu });
        sda.push({ x0: s, x1: e, lv: 1 }); cu = 1; cursor = e;
      } else {
        var chg = s + c.w * W * 0.25;
        sda.push({ x0: cursor, x1: chg, lv: cu });
        sda.push({ x0: chg, x1: e, lv: c.v }); cu = c.v; cursor = e;
      }
    });
    sda.push({ x0: cursor, x1: totalW - 6, lv: cu });

    var inner = '';
    cells.forEach(function (c, i) {
      var cx = starts[i] + c.w * W / 2;
      inner += '<text x="' + cx + '" y="' + (top + H + 16) + '" text-anchor="middle" class="bit-tag" fill="' + ccolor(c) + '">' + cname(c) + '</text>';
    });
    cells.forEach(function (c, i) {
      if (c.t === 'bit' && c.v === 1) {
        inner += '<rect x="' + (starts[i] + 2) + '" y="' + (top + H * 0.5) + '" width="' + (c.w * W - 4) + '" height="' + (H * 0.5) + '" fill="rgba(78,107,255,.05)"/>';
      }
    });
    inner += '<path d="M' + (padL - 8) + ' ' + (top + H + 22) + ' H' + (totalW - 6) + '" stroke="var(--rule)"/>';
    inner += '<path d="' + sclD() + '" class="sig"/>';
    inner += '<path d="' + segPath(sda, top, H, padL, totalW - padL) + '" class="sig-t"/>';

    var byteUs = Math.round(1e6 / (rate * 1000));
    var frameUs = Math.round(cells.length * byteUs * 1.15);
    var aHex = ('0' + addr7.toString(16).toUpperCase()).slice(-2);
    var dHex = ('0' + data.toString(16).toUpperCase()).slice(-2);
    inner += '<text x="' + (totalW / 2) + '" y="' + (top + H + 40) + '" text-anchor="middle" class="lbl">每 bit ≈ ' + byteUs +
      ' µs（' + rate + ' kHz）· 本帧约 ' + frameUs + ' µs · 从机地址 0x' + aHex + '（写 0x' +
      ('0' + ((addr7 << 1) & 0xFF).toString(16).toUpperCase()).slice(-2) + ' / 读 0x' +
      ('0' + ((addr7 << 1 | 1) & 0xFF).toString(16).toUpperCase()).slice(-2) + '）</text>';

    $('#scopeSvg').innerHTML = svgWrap(totalW, top + H + 56, inner);
    if (op === 'write') {
      $('#scopeInfo').innerHTML = 'I2C <b>写操作</b>：<b>S → 地址 0x' + aHex + '+W → ACK → 数据 0x' + dHex + ' → ACK → P</b> · 每字节第 9 个时钟为应答位';
    } else {
      $('#scopeInfo').innerHTML = 'I2C <b>读操作</b>：<b>S → 地址+W → ACK → 寄存器 0x' + ('0' + reg.toString(16).toUpperCase()).slice(-2) +
        ' → ACK → Sr → 地址+R → ACK → 数据 0x' + dHex + ' → NACK → P</b> · 注意读操作末尾主机必须回 NACK';
    }

    // 逐位解读
    var chips = [];
    cells.forEach(function (c, i) {
      var cls = 'dc-c1';
      if (c.t === 'start') cls = 'dc-c5';
      else if (c.t === 'ack') cls = 'dc-c2';
      else if (c.t === 'nack') cls = 'dc-c4';
      else if (c.t === 'stop') cls = 'dc-c4';
      var label = cname(c);
      var desc = '';
      if (c.t === 'start') desc = c.sr ? '重复起始：不释放总线切读方向' : '起始条件 SCL高时SDA↓';
      else if (c.t === 'stop') desc = '停止条件 SCL高时SDA↑';
      else if (c.t === 'ack') desc = (c.seg === 'addr1' || c.seg === 'addr2') ? '从机应答地址' : '从机应答数据';
      else if (c.t === 'nack') desc = '主机不应答，通知结束';
      else if (c.seg === 'addr1') desc = '地址+W = 0x' + ('0' + ((addr7 << 1) & 0xFF).toString(16).toUpperCase()).slice(-2);
      else if (c.seg === 'addr2') desc = '地址+R = 0x' + ('0' + ((addr7 << 1 | 1) & 0xFF).toString(16).toUpperCase()).slice(-2);
      else if (c.seg === 'reg') desc = '寄存器地址 0x' + ('0' + reg.toString(16).toUpperCase()).slice(-2);
      else desc = '数据 0x' + dHex;
      chips.push({ t: label, d: desc, cls: cls });
    });
    showDecode([chips]);
  }

  /* ================= ③ SPI 波形 ================= */
  function genSpi() {
    var mode = parseInt($('#sMode').value, 10) || 0;
    var data = hex2byte($('#sData').value);
    var cpol = (mode >> 1) & 1, cpha = mode & 1;
    var W = 52, H = 42, top = 24, padL = 18, n = 8;
    var bits = [];
    for (var i = 7; i >= 0; i--) bits.push((data >> i) & 1);
    var totalW = padL * 2 + n * W;

    function sclkD() {
      var d = 'M' + (padL - 10) + ' ' + (top + (cpol ? 0 : H));
      for (var i = 0; i < n; i++) {
        var s = padL + i * W, mid = s + W / 2, e = s + W;
        if (cpol === 0) {
          d += ' L' + s + ' ' + (top + H) + ' L' + mid + ' ' + (top + H) + ' L' + mid + ' ' + top + ' L' + e + ' ' + top + ' L' + e + ' ' + (top + H);
        } else {
          d += ' L' + s + ' ' + top + ' L' + mid + ' ' + top + ' L' + mid + ' ' + (top + H) + ' L' + e + ' ' + (top + H) + ' L' + e + ' ' + top;
        }
      }
      return d + ' H' + (totalW - 6);
    }
    function mosiD() {
      var segs = [];
      for (var i = 0; i < n; i++) {
        var s = padL + i * W;
        var x0 = cpha === 0 ? s : s + W * 0.3;
        var x1 = cpha === 0 ? s + W * 0.62 : s + W * 1.18;
        segs.push({ x0: x0, x1: x1, lv: bits[i] });
      }
      return segPath(segs, top, H, padL, totalW - padL);
    }
    function sampleMarks() {
      var g = '';
      for (var i = 0; i < n; i++) {
        var x = cpha === 0 ? (padL + i * W + W / 2) : (padL + (i + 1) * W);
        var y = top + H + 14;
        g += '<circle cx="' + x + '" cy="' + y + '" r="4.5" class="sample-dot"/>';
        g += '<path d="M' + (x - 6) + ' ' + (y + 7) + ' L' + x + ' ' + (y + 14) + ' L' + (x + 6) + ' ' + (y + 7) + ' Z" fill="rgba(15,163,160,.9)"/>';
      }
      return g;
    }

    var inner = '';
    for (var i = 0; i < n; i++) {
      inner += '<text x="' + (padL + i * W + W / 2) + '" y="' + (top + H + 34) + '" text-anchor="middle" class="bit-tag">D' + i + '=' + bits[i] + '</text>';
    }
    inner += '<line x1="' + (padL - 10) + '" y1="' + (top + H + 14) + '" x2="' + (totalW - 6) + '" y2="' + (top + H + 14) + '" stroke="var(--rule)"/>';
    inner += '<path d="' + sclkD() + '" class="sig"/>';
    inner += '<path d="' + mosiD() + '" class="sig-o"/>';
    inner += sampleMarks();
    inner += '<text x="' + (totalW / 2) + '" y="' + (top + H + 50) + '" text-anchor="middle" class="lbl">Mode ' + mode + '（CPOL=' + cpol +
      '，CPHA=' + cpha + '）· 数据 0x' + ('0' + data.toString(16).toUpperCase()).slice(-2) + ' · 采样点箭头位置即数据被锁存的时刻</text>';

    $('#scopeSvg').innerHTML = svgWrap(totalW, top + H + 64, inner);
    var sampleTxt = cpha === 0 ? '第一个沿（前沿）采样' : '第二个沿（后沿）采样';
    $('#scopeInfo').innerHTML = 'SPI Mode ' + mode + '：' + (cpol ? 'SCLK 空闲高' : 'SCLK 空闲低') + ' + ' + sampleTxt +
      '。主机与从机必须使用相同模式，否则数据会错位。';

    // 逐位解读
    var schips = [{ t: 'Mode ' + mode, d: 'CPOL=' + cpol + ' CPHA=' + cpha + '，采样沿如箭头', cls: 'dc-c3' }];
    for (var si = 0; si < 8; si++) schips.push({ t: 'D' + (7 - si), d: '= ' + bits[si], cls: 'dc-c1' });
    showDecode([schips]);
  }

  /* ================= ④ CAN 帧（标准/扩展/FD） ================= */
  function genCan() {
    var type = ($('#cType') || { value: 'standard' }).value;
    var isExt = type === 'extended';
    var isFd = type === 'fd';
    var idMax = isExt ? 0x1FFFFFFF : 0x7FF;
    var id = parseInt($('#cId').value.replace(/^0x/i, ''), 16) & idMax;
    var dlcMax = isFd ? 64 : 8;
    var dlc = Math.min(dlcMax, Math.max(0, parseInt($('#cDlc').value, 10) || 0));
    var rate = parseInt($('#cRate').value, 10) || 500;

    var arbW = isExt ? 32 : 12;   // 仲裁场（扩展=11+SRR+IDE+18+RTR）
    var crcW = isFd ? (dlc > 16 ? 21 : 17) : 16;
    var fields = [
      { n: 'SOF', w: 1, c: '#334155' },
      { n: '仲裁场 ' + (isExt ? '29位ID' : '11位ID'), w: arbW, c: '#8B5CF6' },
      { n: '控制场' + (isFd ? ' (FDF/BRS)' : ''), w: 6, c: '#4E6BFF' },
      { n: '数据场 ' + dlc + 'B', w: dlc * 8, c: '#0FA3A0' },
      { n: 'CRC 场 ' + crcW + 'b', w: crcW, c: '#F59E0B' },
      { n: 'ACK', w: 2, c: '#EF4444' },
      { n: 'EOF', w: 7, c: '#64748B' }
    ];
    var totalBits = fields.reduce(function (a, f) { return a + f.w; }, 0) + 3; // +IFS
    var fillEst = Math.round(totalBits / 8);
    var realBits = totalBits + fillEst;
    var frameUs;
    if (isFd) {
      // FD：仲裁段按 rate，数据+CRC 段按 2 Mbps 示意
      var arbBits = 1 + arbW + 6;
      var fastBits = dlc * 8 + crcW + 2 + 7 + 3;
      frameUs = Math.round(arbBits * 1000 / rate + fastBits * 1000 / 2000);
    } else {
      frameUs = Math.round(realBits * 1000 / rate);
    }

    var W = 16, top = 30, H = 54, padL = 16;
    var totalW = padL * 2 + totalBits * W;
    var x = padL;
    var inner = '';
    fields.forEach(function (f) {
      var wpx = f.w * W;
      inner += '<rect x="' + x + '" y="' + top + '" width="' + wpx + '" height="' + H + '" fill="' + f.c + '" rx="3"/>';
      inner += '<text x="' + (x + wpx / 2) + '" y="' + (top + 28) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#fff" font-family="' + MONO + '">' + f.n + '</text>';
      inner += '<text x="' + (x + wpx / 2) + '" y="' + (top + 44) + '" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.85)" font-family="' + MONO + '">' + f.w + ' bit</text>';
      x += wpx;
    });
    inner += '<line x1="' + padL + '" y1="' + (top + H + 12) + '" x2="' + (totalW - padL) + '" y2="' + (top + H + 12) + '" stroke="var(--rule)"/>';
    var idBin = isExt ? ('00000000000000000000000000000' + id.toString(2)).slice(-29) : ('00000000000' + id.toString(2)).slice(-11);
    var idHexLen = isExt ? 8 : 3;
    inner += '<text x="' + (totalW / 2) + '" y="' + (top + H + 32) + '" text-anchor="middle" class="lbl">' +
      (isFd ? 'CAN FD ' : (isExt ? '扩展帧 ' : '标准帧 ')) + 'ID=0x' + ('00000000' + id.toString(16).toUpperCase()).slice(-idHexLen) +
      '（' + idBin + 'b）· DLC=' + dlc + ' · 帧长约 ' + realBits + ' 位（含填充）· 占线约 ' + frameUs + ' µs @ ' + rate + ' kbps' +
      (isFd ? '（数据段 2 Mbps）' : '') + '</text>';

    $('#scopeSvg').innerHTML = svgWrap(totalW, top + H + 48, inner);
    var infoText = isFd
      ? 'CAN FD 帧：<b>SOF + 仲裁(' + (isExt ? 29 : 11) + '位ID) + 控制(FDF/BRS) + 数据(' + dlc + 'B) + CRC(' + crcW + 'b) + ACK + EOF</b>，数据段用 BRS 位提速。'
      : (isExt
        ? 'CAN 扩展帧：<b>SOF + 仲裁(29位ID+SRR+IDE+RTR=32) + 控制(6) + 数据(' + dlc + 'B) + CRC(16) + ACK(2) + EOF(7)</b>。'
        : 'CAN 标准数据帧：<b>SOF + ID(11) + RTR + IDE/r0 + DLC(4) + 数据(' + dlc + 'B) + CRC(15+1) + ACK(1+1) + EOF(7)</b>。ID 越小优先级越高，此帧占线时间约 ' + frameUs + ' µs。');
    $('#scopeInfo').innerHTML = infoText;

    // 逐位解读
    var cchips = [
      { t: 'SOF', d: '1 bit = 0（同步）', cls: 'dc-c6' },
      { t: isExt ? 'ID' : 'ID', d: (isExt ? 29 : 11) + ' bit = 0x' + ('00000000' + id.toString(16).toUpperCase()).slice(-idHexLen), cls: 'dc-c5' },
      { t: 'RTR', d: '= 0（数据帧）', cls: 'dc-c5' },
      { t: '控制', d: '6 bit（DLC=' + dlc + (isFd ? '，含 FDF/BRS' : '') + '）', cls: 'dc-c1' },
      { t: '数据', d: dlc + ' B = ' + dlc * 8 + ' bit', cls: 'dc-c2' },
      { t: 'CRC', d: crcW + ' bit 校验', cls: 'dc-c3' },
      { t: 'ACK', d: '1+1 bit（任意节点应答）', cls: 'dc-c4' },
      { t: 'EOF', d: '7 bit = 1', cls: 'dc-c6' }
    ];
    showDecode([cchips]);
  }

  /* ================= 波形分发 ================= */
  function renderWave() {
    if (CUR.proto === 'UART') genUart();
    else if (CUR.proto === 'I2C') genI2c();
    else if (CUR.proto === 'SPI') genSpi();
    else genCan();
  }

  /* ================= CAN 位时序计算器 ================= */
  function calcBitTiming() {
    var baud = parseFloat($('#btBaud').value) || 500;
    var tq = parseInt($('#btTq').value, 10) || 16;
    var sync = parseInt($('#btSync').value, 10) || 1;
    var prop = parseInt($('#btProp').value, 10) || 3;
    var ps1 = parseInt($('#btPs1').value, 10) || 10;
    var ps2 = parseInt($('#btPs2').value, 10) || 2;
    var sjw = parseInt($('#btSjw').value, 10) || 1;

    var bitUs = 1000 / baud;              // 位时间 µs
    var tqNs = Math.round(bitUs * 1000 / tq); // 每 TQ ns
    var sum = sync + prop + ps1 + ps2;
    var sample = Math.round((sync + prop + ps1) / sum * 1000) / 10;
    var warnings = [];
    if (sum !== tq) warnings.push({ ok: false, t: '分段之和 = ' + sum + ' TQ ≠ 配置的 ' + tq + ' TQ/位，请调整' });
    if (sample < 75 || sample > 87) warnings.push({ ok: false, t: '采样点 ' + sample + '% 超出建议的 75%~87% 区间' });
    else warnings.push({ ok: true, t: '采样点 ' + sample + '% 位于建议区间（75%~87%）' });
    if (sjw > ps1 || sjw > ps2) warnings.push({ ok: false, t: 'SJW=' + sjw + ' 大于 PS1(' + ps1 + ') 或 PS2(' + ps2 + ')，应 ≤ min(PS1,PS2)' });
    else warnings.push({ ok: true, t: 'SJW=' + sjw + ' ≤ min(PS1,PS2)，满足约束' });
    if (warnings.length === 0) warnings.push({ ok: true, t: '配置合理' });

    $('#btOut').innerHTML =
      '<div class="calc-card"><div class="k">位时间</div><div class="v">' + bitUs + ' µs</div></div>' +
      '<div class="calc-card"><div class="k">单 TQ 时长</div><div class="v">' + tqNs + ' ns</div></div>' +
      '<div class="calc-card"><div class="k">采样点位置</div><div class="v hl">' + sample + '%</div></div>' +
      '<div class="calc-card"><div class="k">总线 1 秒最大帧数（8B 标准帧）</div><div class="v">' + Math.round(1000000 / ((sum + 8 + Math.round(sum / 8)) * bitUs)) + '</div></div>';

    // 可视化
    var W = 60, top = 20, H = 46;
    var totalPx = sum * W;
    var segments = [
      { n: 'Sync', v: sync, c: '#4E6BFF' },
      { n: 'Prop', v: prop, c: '#8B5CF6' },
      { n: 'PS1', v: ps1, c: '#0FA3A0' },
      { n: 'PS2', v: ps2, c: '#EF4444' }
    ];
    var inner = '';
    var x = 20;
    segments.forEach(function (s) {
      var w = s.v * W;
      inner += '<rect x="' + x + '" y="' + top + '" width="' + w + '" height="' + H + '" fill="' + s.c + '" opacity=".85"/>';
      inner += '<text x="' + (x + w / 2) + '" y="' + (top + 26) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#fff" font-family="' + MONO + '">' + s.n + '</text>';
      inner += '<text x="' + (x + w / 2) + '" y="' + (top + 40) + '" text-anchor="middle" font-size="9" fill="rgba(255,255,255,.9)" font-family="' + MONO + '">' + s.v + ' TQ</text>';
      x += w;
    });
    var sx = 20 + (sync + prop + ps1) * W;
    inner += '<line x1="' + sx + '" y1="' + (top - 8) + '" x2="' + sx + '" y2="' + (top + H + 6) + '" stroke="#0FA3A0" stroke-width="3"/>';
    inner += '<path d="M' + sx + ' ' + (top + H + 14) + ' L' + (sx - 7) + ' ' + (top + H + 24) + ' L' + (sx + 7) + ' ' + (top + H + 24) + ' Z" fill="#0FA3A0"/>';
    inner += '<text x="' + sx + '" y="' + (top + H + 38) + '" text-anchor="middle" font-size="11" font-weight="700" fill="#0B7D7B" font-family="' + MONO + '">采样点 ' + sample + '%</text>';
    inner += '<text x="' + (x / 2 + 10) + '" y="' + (top - 10) + '" text-anchor="middle" class="lbl">一个位时间 = ' + sum + ' TQ = ' + bitUs + ' µs</text>';

    $('#btVisual').innerHTML = svgWrap(x + 40, top + H + 52, inner);

    // 建议区
    var wHtml = '<div style="margin-top:1rem;font-size:.9rem;">' + warnings.map(function (w) {
      return '<div class="' + (w.ok ? 'bt-ok' : 'bt-bad') + '">' + (w.ok ? '✓' : '✗') + ' ' + w.t + '</div>';
    }).join('') + '</div>';
    var existing = $('#btWarn');
    if (existing) existing.outerHTML = '<div id="btWarn">' + wHtml + '</div>';
    else $('#btVisual').insertAdjacentHTML('afterend', '<div id="btWarn">' + wHtml + '</div>');
  }

  /* ================= 故障诊断 ================= */
  var FAULTS = {
    UART: [
      { name: '波特率不匹配（±5%）', tag: 'UART', sym: '发送方用 115200 发，接收方按 9600 收：采样点持续偏移，数据逐位错位，最终乱码。',
        waves: function (id) {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">发送端波形（115200）</text>';
          inner += '<path d="M30 60 H70 L70 110 L100 110 L100 60 H130 L130 110 L160 110 L160 60 H190 L190 110 L220 110 L220 60 H250 L250 110 L280 110 L280 60 H310 L310 110 L340 110 L340 60 H390" class="sig-b"/>';
          inner += '<text x="240" y="140" text-anchor="middle" class="lbl">接收端采样点（按 9600 采，已严重偏移）</text>';
          var dots = '';
          for (var i = 0; i < 8; i++) {
            var dx = 40 + i * 90;
            dots += '<circle cx="' + dx + '" cy="90" r="4" fill="rgba(239,68,68,.9)"/>';
            dots += '<path d="M' + dx + ' 140 L' + (dx - 30) + ' 152 L' + (dx + 30) + ' 152 Z" fill="rgba(239,68,68,.7)"/>';
          }
          inner += dots;
          inner += '<text x="240" y="178" text-anchor="middle" class="lbl">采样点落在位跳变沿附近 → 读到的电平时对时错 → 乱码</text>';
          return svgWrap(480, 192, inner);
        },
        cause: 'UART 无时钟线，靠"波特率约定"对齐。一方波特率偏差超过约 ±2%（或设置错误），采样点就会漂出位中心安全窗口。',
        steps: ['确认两侧配置相同（常见 115200/9600/57600）', '用示波器数一下起始位到停止位的实际时长，反推真实波特率', '检查晶振精度（USB-TTL 模块与板载晶振偏差）', '长距离/低质量线材下降低波特率或改用 RS-485'] },
      { name: 'RX/TX 交叉接错', tag: 'UART', sym: '把 A.TX 接到了 B.TX（同向）或漏接 GND：没有任何数据，或只有单向通。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">主机 TX ──→ 从机 TX（错误：同向连接）</text>';
          inner += '<path d="M30 50 H60 L60 95 L90 95 L90 50 H120 L120 95 L150 95 L150 50 H180 L180 95 L210 95 L210 50 H240 L240 95 L270 95 L270 50 H300 L300 95 L330 95 L330 50 H360" class="sig-b"/>';
          inner += '<path d="M30 130 H60 L60 175 L90 175 L90 130 H120 L120 175 L150 175 L150 130 H180 L180 175 L210 175 L210 130 H240 L240 175 L270 175 L270 130 H300 L300 175 L330 175 L330 130 H360" class="sig-r" opacity=".8"/>';
          inner += '<text x="240" y="200" text-anchor="middle" class="lbl">两条线都在"发"，没有任何线在"收" → 完全无通信</text>';
          return svgWrap(480, 214, inner);
        },
        cause: 'UART 必须交叉：主 TX → 从 RX，主 RX ← 从 TX，并且两端必须共地（GND 相连）。',
        steps: ['对照原理图逐线核对 TX/RX 交叉', '用万用表量 GND 是否连通', '换一个 USB-TTL 模块排除硬件问题', '用回环测试（TX 短接 RX）验证串口外设本身'] },
      { name: '数据帧格式不一致', tag: 'UART', sym: '一方 8N1，另一方 8E1 或 7E1：能收到字节但校验错、偶发丢帧。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">发送端（8E1：数据 01010101 + 偶校验位 0 + 停止位）</text>';
          inner += '<path d="M20 60 H50 L50 110 L80 110 L80 60 H110 L110 110 L140 110 L140 60 H170 L170 110 L200 110 L200 60 H230 L230 110 L260 110 L260 60 H290 L290 110 L320 110 L320 60 H350 L350 110 L380 110 L380 60 H410 L410 110 L440 110 L440 60 H470 L470 110 L500 110" class="sig-b"/>';
          inner += '<text x="360" y="135" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="' + MONO + '">ST</text>';
          inner += '<text x="410" y="135" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="' + MONO + '">P</text>';
          inner += '<text x="470" y="135" text-anchor="middle" font-size="10" fill="var(--muted)" font-family="' + MONO + '">SP</text>';
          inner += '<text x="240" y="160" text-anchor="middle" class="lbl">接收方按 8N1 解析 → 把校验位当成数据、把停止位当成校验位 → 数据错位</text>';
          return svgWrap(520, 174, inner);
        },
        cause: '8-N-1 / 8-E-1 / 7-E-1 的帧结构不同（数据位数量、校验位有无、停止位数量）。',
        steps: ['查看双方配置：数据位、校验、停止位三者必须完全一致', '上位机串口助手里改帧格式再试', '需要校验时建议用"8E1"或"8O1"并核对奇偶类型'] },
      { name: '两端没有共地（GND 未连接）', tag: 'UART', sym: '波形看起来"正常"但数据乱码或时有时无，且测量 TX/RX 直流电压飘忽不定。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="24" text-anchor="middle" class="lbl">两端参考地不一致 → 逻辑电平阈值偏移</text>';
          inner += '<path d="M20 50 H60 L60 100 L90 100 L90 50 H120 L120 100 L150 100 L150 50 H180 L180 100 L210 100 L210 50 H240 L240 100 L270 100 L270 50 H300 L300 100 L330 100 L330 50 H360" class="sig-b"/>';
          inner += '<path d="M30 60 H70 L70 110 L100 110 L100 60 H130 L130 110 L160 110 L160 60 H190 L190 110 L220 110 L220 60 H250 L250 110 L280 110 L280 60 H310 L310 110 L340 110 L340 60 H370" class="sig-r" opacity=".6" transform="translate(6,-4)"/>';
          inner += '<text x="240" y="140" text-anchor="middle" class="lbl">接收端参考地比发送端高 → 高低电平判断整体偏移 → 采样错乱</text>';
          inner += '<text x="240" y="162" text-anchor="middle" class="lbl">排查：万用表量两端 GND 之间电压，应 ≈ 0V</text>';
          return svgWrap(480, 176, inner);
        },
        cause: 'UART 是单端信号，参考的是本机 GND。两端不共地时，接收端看到的高低电平阈值整体偏移，导致误判。',
        steps: ['确保 TX/RX/GND 三根线都接上', '用万用表直流档量两端 GND 压差（应小于 0.2V）', '长距离或强干扰环境改用 RS-485 差分方案'] }
    ],
    I2C: [
      { name: '总线电容过大 / 速率过快', tag: 'I2C', sym: '高速模式下 SDA/SCL 上升沿"爬"不上去，时序违例，通信随机失败。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="24" text-anchor="middle" class="lbl">400kHz 下总线电容大 → 上升沿严重变缓（RC 限制）</text>';
          inner += '<path d="M20 40 H60 L60 95 L90 95 Q100 70 118 55 L155 55 Q175 55 185 95 L215 95 Q228 68 246 56 L290 56 Q305 56 318 95 L360 95" fill="none" stroke="#0FA3A0" stroke-width="2.2"/>';
          inner += '<path d="M20 40 H60 L60 95 L90 95 Q100 62 120 45 L160 45 L200 45 L240 45 L280 45 L320 45 L360 45" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 4"/>';
          inner += '<text x="240" y="125" text-anchor="middle" class="lbl">虚线 = 期望的陡峭上升沿；实线 = 实际爬坡（τ = R×C 过大）</text>';
          inner += '<text x="240" y="147" text-anchor="middle" class="lbl">解决：降低速率、减小上拉电阻、缩短走线或加总线复用器</text>';
          return svgWrap(480, 160, inner);
        },
        cause: 'I2C 上拉电阻与总线电容决定上升时间 τ=R×C。电容过大（长线、多器件、走线过宽）或上拉过大时，上升沿来不及在半个时钟周期内完成。',
        steps: ['按速率选上拉：100k→4.7kΩ、400k→2.2kΩ', '缩短 SDA/SCL 走线，避免跨板飞线过长', '减少总线上器件数或用 I2C 复用器分段', '确有必要时降低速率档位'] },
      { name: '缺少上拉电阻', tag: 'I2C', sym: 'SCL/SDA 电平"爬"不上去：上升沿极缓甚至悬空，从机偶发响应或完全无响应。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">SCL（无上拉：上升沿缓慢、电平偏低）</text>';
          inner += '<path d="M20 40 H60 L60 95 L90 95 Q100 60 115 52 L140 52 Q155 52 165 95 L195 95 Q205 62 220 53 L245 53 Q260 53 270 95 L300 95 Q310 60 325 52 L360 52" fill="none" stroke="#0FA3A0" stroke-width="2.2"/>';
          inner += '<text x="240" y="120" text-anchor="middle" class="lbl">理想上拉应是陡峭上升沿，这里呈"圆角爬坡" → 时序容差被吃掉</text>';
          inner += '<path d="M20 140 H60 L60 195 L90 195 Q100 160 115 152 L140 152 Q155 152 165 195 L195 195 Q205 162 220 153 L245 153 Q260 153 270 195 L300 195 Q310 160 325 152 L360 152" fill="none" stroke="var(--muted)" stroke-width="2" opacity=".5"/>';
          inner += '<text x="240" y="224" text-anchor="middle" class="lbl">SDA 同样爬坡（虚线）——两条线都必须有上拉</text>';
          return svgWrap(480, 238, inner);
        },
        cause: 'I2C 是开漏输出，没有上拉电阻总线无法回到高电平。常见于"飞线"实验或忘了在板上焊 R。',
        steps: ['量 SCL/SDA 对 GND 电压：空闲时应接近 VCC，若悬空抖动则是没上拉', '每根线上拉到 VCC（100kHz→4.7kΩ，400kHz→2.2kΩ）', '注意 3.3V 与 5V 器件混用需电平转换，不能简单直连'] },
      { name: '从机地址错误', tag: 'I2C', sym: '主机发的地址没人应答：ACK 槽 SDA 保持高（NACK），传输立即失败。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">地址 0x68（1011000 + W）→ 实际器件是 0x50</text>';
          // SCL 9 个脉冲
          var scl = 'M20 40 H50';
          for (var i = 0; i < 9; i++) {
            var s = 50 + i * 50;
            scl += ' L' + s + ' 90 L' + (s + 25) + ' 90 L' + (s + 25) + ' 40 L' + (s + 50) + ' 40';
          }
          inner += '<path d="' + scl + '" class="sig"/>';
          // SDA 地址位 10110000 + NACK(高)
          var addr = [1, 0, 1, 1, 0, 0, 0, 0];
          var seg = '', cur = 1, cx = 20;
          addr.forEach(function (b, i) {
            var s = 50 + i * 50, chg = s + 15;
            seg += 'M' + cx + ' ' + (cur ? 40 : 90) + ' H' + chg + ' V' + (b ? 40 : 90);
            cur = b; cx = chg;
            seg += ' H' + (s + 50);
          });
          // 第 9 位: NACK 高
          seg += ' M' + cx + ' ' + (cur ? 40 : 90) + ' H' + (50 + 8 * 50) + ' V40 H' + (50 + 9 * 50);
          inner += '<path d="' + seg + '" class="sig-t"/>';
          inner += '<rect x="' + (50 + 8 * 50) + '" y="24" width="50" height="88" rx="8" fill="rgba(239,68,68,.12)" stroke="var(--c-can)" stroke-dasharray="5 3"/>';
          inner += '<text x="' + (50 + 8 * 50 + 25) + '" y="130" text-anchor="middle" font-size="10" font-weight="700" fill="#C53030">NACK！</text>';
          inner += '<text x="300" y="152" text-anchor="middle" class="lbl">从机不匹配地址 → 不应答 → 主机只能放弃本次传输</text>';
          return svgWrap(560, 168, inner);
        },
        cause: '最常见：把"8 位地址"直接当成 7 位用（0xD0 写成了 0x68），或器件地址跳线（A0A1A2）与代码不符。',
        steps: ['确认 7 位 vs 8 位：8 位 = 7 位 << 1 + R/W', '对照数据手册核对地址引脚设置', '用 i2cdetect 或扫描程序把总线扫一遍，看器件真实地址'] },
      { name: '读操作漏了 NACK', tag: 'I2C', sym: '读最后一个字节时主机回了 ACK：从机以为还要继续发，总线被"粘"住，下一帧错乱。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">错误：最后字节回 ACK（×） vs 正确：最后字节回 NACK（√）</text>';
          inner += '<text x="120" y="52" text-anchor="middle" font-size="11" font-weight="700" fill="#C53030">错误写法</text>';
          inner += '<path d="M20 70 H240" stroke="var(--muted)" stroke-dasharray="4 3"/>';
          var scl1 = 'M20 80 H50 L50 130 L75 130 L75 80 H105 L105 130 L130 130 L130 80 H160 L160 130 L185 130 L185 80';
          inner += '<path d="' + scl1 + '" class="sig" opacity=".6"/>';
          inner += '<path d="M20 100 H55 V140 H80 V100 H110 V140 H135 V100 H165 V140 H185 V100 H210" class="sig-t" opacity=".6"/>';
          inner += '<text x="185" y="155" text-anchor="middle" font-size="10" fill="#C53030" font-family="' + MONO + '">ACK(×)</text>';
          inner += '<text x="120" y="185" text-anchor="middle" font-size="11" font-weight="700" fill="#0B7D7B">正确写法</text>';
          inner += '<path d="M20 200 H50 L50 250 L75 250 L75 200 H105 L105 250 L130 250 L130 200 H160 L160 250 L185 250 L185 200" class="sig" opacity=".6"/>';
          inner += '<path d="M20 220 H55 V260 H80 V220 H110 V260 H135 V220 H165 V260 H185 V220 H210" class="sig-t" opacity=".6"/>';
          inner += '<text x="185" y="275" text-anchor="middle" font-size="10" fill="#0B7D7B" font-family="' + MONO + '">NACK(√)</text>';
          return svgWrap(420, 290, inner);
        },
        cause: '读操作最后必须 NACK：从机看到 NACK 才停止发送并释放总线。很多初学驱动只实现了"发完就停"。',
        steps: ['检查读函数最后一字节是否回 NACK', '逻辑分析仪看 ACK 槽电平', '参考成熟驱动（如 Linux i2c-dev、Arduino Wire）的读实现'] }
    ],
    SPI: [
      { name: '主从模式不匹配', tag: 'SPI', sym: 'SCLK 空闲电平/采样沿不一致：看似在传数据，读回来的值全错或错位一位。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">主机 Mode 0（空闲低） vs 从机 Mode 2（空闲高）</text>';
          inner += '<text x="100" y="48" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">主机 SCLK</text>';
          inner += '<path d="M20 60 H60 L60 110 L90 110 L90 60 H120 L120 110 L150 110 L150 60 H180 L180 110 L210 110 L210 60 H240 L240 110 L270 110 L270 60 H300 L300 110 L330 110 L330 60 H360" class="sig-b"/>';
          inner += '<text x="100" y="140" text-anchor="middle" font-size="10" font-weight="700" fill="#C53030">从机 SCLK</text>';
          inner += '<path d="M20 152 H60 L60 102 L90 102 L90 152 H120 L120 102 L150 102 L150 152 H180 L180 102 L210 102 L210 152 H240 L240 102 L270 102 L270 152 H300 L300 102 L330 102 L330 152 H360" class="sig-r"/>';
          inner += '<text x="240" y="182" text-anchor="middle" class="lbl">一个空闲低一个空闲高 → 采样沿完全错开 → 数据对不上</text>';
          return svgWrap(480, 196, inner);
        },
        cause: 'CPOL/CPHA 组合必须主从一致。Mode 0 是默认，但不少器件默认 Mode 1/2/3。',
        steps: ['查从机数据手册的时序图，确定其模式', '把主机改成相同模式（软件配置 SPI CR1 的 CPOL/CPHA）', '用逻辑分析仪对比 SCLK 与 MOSI 的对齐关系'] },
      { name: 'CS 未被拉低/悬空', tag: 'SPI', sym: 'SCLK/MOSI 波形正常，但从机完全无输出（MISO 恒高或浮空）。',
        waves: function () {
          var inner = '';
          inner += '<text x="240" y="22" text-anchor="middle" class="lbl">CS 一直为高（从机从未被选中）</text>';
          inner += '<text x="100" y="50" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">CS</text>';
          inner += '<path d="M20 62 H400" class="sig-r"/>';
          inner += '<text x="100" y="90" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">SCLK</text>';
          inner += '<path d="M20 102 H60 L60 152 L90 152 L90 102 H120 L120 152 L150 152 L150 102 H180 L180 152 L210 152 L210 102 H240 L240 152 L270 152 L270 102 H300 L300 152 L330 152 L330 102 H360" class="sig" opacity=".6"/>';
          inner += '<text x="240" y="180" text-anchor="middle" class="lbl">从机要求 CS 低电平有效 → CS 不拉低，从机把 MISO 置高阻，主机读到 0xFF/浮空</text>';
          return svgWrap(480, 194, inner);
        },
        cause: 'CS 引脚未配置/未初始化、GPIO 模式错了、或用了错误的片选号。',
        steps: ['确认 CS 对应的 GPIO 已配置为输出且能拉低', '示波器抓 CS 下降沿是否出现', '软件上先拉低 CS 再开始时钟，结束后再拉高'] }
    ],
    CAN: [
      { name: '缺少终端电阻', tag: 'CAN', sym: '波形末端出现明显振铃/过冲，隐性位电平漂移，总线错误帧频发。',
        waves: function () {
          var inner = '';
          inner += '<text x="260" y="24" text-anchor="middle" class="lbl">显性 → 隐性跳变处出现反射振铃（无 120Ω 终端）</text>';
          inner += '<path d="M20 50 H60 L60 120 L120 120 Q180 120 200 95 Q210 80 220 95 Q232 112 250 95 Q262 84 272 95 Q282 106 296 95 L340 95 L340 50 H400" fill="none" stroke="#0B7D7B" stroke-width="2.4"/>';
          inner += '<path d="M20 50 H60 L60 120 L120 120 L200 80 L300 80 L300 50 H400" fill="none" stroke="var(--muted)" stroke-width="1.6" stroke-dasharray="5 4"/>';
          inner += '<text x="260" y="155" text-anchor="middle" font-size="10" fill="var(--muted)">虚线 = 正确波形（无振铃）</text>';
          inner += '<text x="260" y="176" text-anchor="middle" class="lbl">反射让接收器误判电平 → CRC 错误率升高 → 错误帧频繁出现</text>';
          return svgWrap(520, 190, inner);
        },
        cause: '总线两端必须各接 120Ω。常见错误：只接了一端、中间节点误接、或调试板忘了装跳线帽。',
        steps: ['测量 CAN_H 与 CAN_L 之间静态电阻：约 60Ω 正常，120Ω 是缺一端，极大值是完全没接', '确认终端只在最远两端', '断开电源测量，防止收发器影响读数'] },
      { name: '波特率不匹配', tag: 'CAN', sym: '节点 A 500k，节点 B 250k：双方都收不到对方，各自疯狂报错，总线被错误帧占满。',
        waves: function () {
          var inner = '';
          inner += '<text x="260" y="24" text-anchor="middle" class="lbl">500k 发送位流 vs 250k 采样窗口（采样点漂移出位）</text>';
          inner += '<text x="90" y="52" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">500k 发</text>';
          inner += '<path d="M30 66 H60 L60 120 L90 120 L90 66 H120 L120 120 L150 120 L150 66 H180 L180 120 L210 120 L210 66 H240 L240 120 L270 120 L270 66 H300 L300 120 L330 120 L330 66 H360" class="sig-b"/>';
          inner += '<text x="90" y="155" text-anchor="middle" font-size="10" font-weight="700" fill="#C53030">250k 采</text>';
          inner += '<path d="M30 168 H60 L60 120 L120 120 L120 168 H180 L180 120 L240 120 L240 168 H300 L300 120 L360 120 L360 168" class="sig-r" opacity=".7"/>';
          inner += '<circle cx="90" cy="144" r="4.5" fill="rgba(239,68,68,.9)"/><circle cx="180" cy="144" r="4.5" fill="rgba(239,68,68,.9)"/><circle cx="270" cy="144" r="4.5" fill="rgba(239,68,68,.9)"/><circle cx="360" cy="144" r="4.5" fill="rgba(239,68,68,.9)"/>';
          inner += '<text x="260" y="196" text-anchor="middle" class="lbl">采样点落在错误的位 → 位错误/填充错误 → 持续错误帧</text>';
          return svgWrap(520, 210, inner);
        },
        cause: 'CAN 要求全网波特率与采样点一致。波特率不匹配时发送方收不到 ACK（应答错误），不断重发。',
        steps: ['用示波器/总线分析仪测实际位时间，反推波特率', '检查各节点 MCU 时钟与预分频配置', '用 CAN 分析工具（如 PCAN、CANalyzer 扫描）确认全网一致'] },
      { name: 'CAN_H 或 CAN_L 断路', tag: 'CAN', sym: '单线断路后差分电压异常：显性幅值减半，总线处于"半损坏"状态，报文大量丢失。',
        waves: function () {
          var inner = '';
          inner += '<text x="260" y="24" text-anchor="middle" class="lbl">正常差分（上） vs CAN_H 断路后的差分（下）</text>';
          inner += '<path d="M30 55 H70 L70 60 L110 60 L110 105 L150 105 L150 60 L190 60 L190 55 H230" class="sig-t" stroke-width="2.4"/>';
          inner += '<path d="M30 85 H70 L70 60 L110 60 L110 105 L150 105 L150 60 L190 60 L190 85 H230" class="sig" opacity=".4"/>';
          inner += '<path d="M300 55 H340 L340 70 L380 70 L380 95 L420 95 L420 70 L460 70 L460 55 H500" class="sig-t" stroke-width="2.4" opacity=".55"/>';
          inner += '<text x="260" y="140" text-anchor="middle" class="lbl">CAN_H 开路时显性差分只剩一半 → 接收阈值附近抖动 → 大量误码</text>';
          inner += '<text x="260" y="162" text-anchor="middle" class="lbl">故障节点表现为"间歇通信、错误计数攀升"</text>';
          return svgWrap(520, 176, inner);
        },
        cause: '线束断线、连接器退针、端子氧化。单线仍可"部分工作"但极不稳定。',
        steps: ['用万用表分段量 CAN_H/CAN_L 通断', '晃动线束看通信是否中断，定位接触不良点', '检查连接器压接与端子', '换线/换端子后重新验证终端电阻'] },
      { name: '节点进入 Bus-off', tag: 'CAN', sym: '某个节点错误计数爆表后完全静默（高阻），其它节点通信正常，但该节点"消失了"。',
        waves: function () {
          var inner = '';
          inner += '<text x="260" y="24" text-anchor="middle" class="lbl">该节点错误计数增长曲线（TEC 超过 255 触发 Bus-off）</text>';
          inner += '<path d="M30 130 L120 120 L180 105 L230 80 L270 60 L300 48 L330 42" fill="none" stroke="var(--c-can)" stroke-width="2.6"/>';
          inner += '<line x1="30" y1="48" x2="380" y2="48" stroke="var(--muted)" stroke-dasharray="5 4"/>';
          inner += '<text x="385" y="52" font-size="10" fill="#C53030" font-family="' + MONO + '">255 阈值</text>';
          inner += '<text x="330" y="36" text-anchor="middle" font-size="10" font-weight="700" fill="#C53030">Bus-off</text>';
          inner += '<text x="260" y="170" text-anchor="middle" class="lbl">Bus-off 后：该节点输出高阻、停止一切收发，需 128 次总线空闲才恢复</text>';
          return svgWrap(520, 184, inner);
        },
        cause: '通常是节点自身硬件/软件问题（晶振偏差、看门狗复位、收发器损坏），错误计数持续上涨直至 Bus-off。',
        steps: ['读该节点的 TEC/REC 寄存器确认状态', '检查该节点晶振频率与容差', '排查是否与其它节点有波特率/采样点差异', '在总线静默时复位该节点观察是否恢复'] },
      { name: '节点采样点差异过大', tag: 'CAN', sym: '两节点波特率相同但采样点相差很远（如 60% vs 90%）：帧偶尔出错、错误计数缓慢增长。',
        waves: function () {
          var inner = '';
          inner += '<text x="260" y="24" text-anchor="middle" class="lbl">同一帧的两个采样点：A 节点 60% 采样，B 节点 90% 采样</text>';
          inner += '<text x="90" y="52" text-anchor="middle" font-size="10" font-weight="700" fill="var(--ink)">位流</text>';
          inner += '<path d="M30 66 H60 L60 120 L90 120 L90 66 H120 L120 120 L150 120 L150 66 H180 L180 120 L210 120 L210 66 H240 L240 120 L270 120 L270 66 H300 L300 120 L330 120 L330 66 H360" class="sig" opacity=".7"/>';
          inner += '<path d="M30 90 L420 90" stroke="var(--muted)" stroke-dasharray="4 3"/>';
          // 采样点竖线
          inner += '<line x1="' + (30 + (210 - 30) * 0.6) + '" y1="138" x2="' + (30 + (210 - 30) * 0.6) + '" y2="150" stroke="#EF4444" stroke-width="2.5"/>';
          inner += '<text x="' + (30 + (210 - 30) * 0.6) + '" y="166" text-anchor="middle" font-size="10" fill="#C53030" font-family="' + MONO + '">A 采 60%</text>';
          inner += '<line x1="' + (30 + (210 - 30) * 0.9) + '" y1="138" x2="' + (30 + (210 - 30) * 0.9) + '" y2="150" stroke="#0FA3A0" stroke-width="2.5"/>';
          inner += '<text x="' + (30 + (210 - 30) * 0.9) + '" y="166" text-anchor="middle" font-size="10" fill="#0B7D7B" font-family="' + MONO + '">B 采 90%</text>';
          inner += '<text x="260" y="192" text-anchor="middle" class="lbl">位长 180px 时两点相距约 54px——若此处刚好是跳变沿，两端判断可能不一致</text>';
          return svgWrap(520, 206, inner);
        },
        cause: '采样点决定"在哪一刻判决位电平"。全网采样点差异大时，采样点靠近跳变沿的节点更容易误判，错误计数缓慢增长、偶尔丢帧。',
        steps: ['用总线分析仪读出各节点实际采样点', '统一配置：建议 75%~87%（常用 80%），SJW 合理设置', '检查各节点晶振偏差与 TQ 分配，重新计算段参数'] }
    ]
  };

  function renderFaultList() {
    var list = FAULTS[CUR.proto];
    $('#faultList').innerHTML = list.map(function (f, i) {
      var color = { UART: 'var(--c-uart)', I2C: 'var(--c-i2c)', SPI: 'var(--c-spi)', CAN: 'var(--c-can)' }[f.tag];
      return '<div class="fault-card" data-fault="' + i + '"><span class="tag" style="background:' + color + '">' + f.tag + '</span>' +
        '<h4>' + f.name + '</h4><div class="sym">' + f.sym + '</div></div>';
    }).join('');
    $('#faultDetail').classList.remove('on');
    $('#faultDetail').innerHTML = '';
  }

  function showFault(idx) {
    var f = FAULTS[CUR.proto][idx];
    var color = { UART: 'var(--c-uart)', I2C: 'var(--c-i2c)', SPI: 'var(--c-spi)', CAN: 'var(--c-can)' }[f.tag];
    var det = $('#faultDetail');
    det.innerHTML = '<span class="tag" style="background:' + color + '">' + f.tag + '</span>' +
      '<h2 style="margin:.4rem 0;">' + f.name + '</h2>' +
      '<div class="fd-sym">' + f.waves(idx) + '</div>' +
      '<div class="card" style="background:var(--bg2);border:1px solid var(--rule);border-radius:12px;padding:1rem;">' +
      '<h3>根本原因</h3><p style="font-size:.92rem;">' + f.cause + '</p>' +
      '<h3>排查步骤</h3><ul>' + f.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ul></div>';
    det.classList.add('on');
    $all('.fault-card').forEach(function (c) { c.classList.toggle('on', parseInt(c.getAttribute('data-fault'), 10) === idx); });
  }

  /* ================= 事件绑定 ================= */
  function bindTabs() {
    $all('#mainTabs .tab-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $all('#mainTabs .tab-btn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        $all('.tab-panel').forEach(function (p) { p.classList.remove('on'); });
        $('#tab-' + b.getAttribute('data-tab')).classList.add('on');
      });
    });
    // 协议切换（波形实验室）
    $all('#protoTabs .proto-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $all('#protoTabs .proto-btn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        CUR.proto = b.getAttribute('data-p');
        $all('.proto-cfg').forEach(function (p) { p.style.display = 'none'; });
        $('#cfg-' + CUR.proto).style.display = '';
        renderWave();
      });
    });
    // 协议切换（故障诊断）
    $all('#faultProtoTabs .proto-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        $all('#faultProtoTabs .proto-btn').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        CUR.proto = b.getAttribute('data-p');
        renderFaultList();
      });
    });
    $('#faultList').addEventListener('click', function (e) {
      var card = e.target.closest('.fault-card');
      if (card) showFault(parseInt(card.getAttribute('data-fault'), 10));
    });
    $('#refreshBtn').addEventListener('click', renderWave);
  }

  function bindInputs() {
    var inputs = 'uData,uBaud,uParity,uStop,iAddr,iData,iReg,iOp,iRate,sMode,sData,cId,cDlc,cRate,cType'.split(',');
    inputs.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderWave);
        el.addEventListener('change', renderWave); // select 控件兼容
      }
    });
    var bt = 'btBaud,btTq,btSync,btProp,btPs1,btPs2,btSjw'.split(',');
    bt.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', calcBitTiming);
        el.addEventListener('change', calcBitTiming);
      }
    });
  }

  bindTabs();
  bindInputs();
  renderWave();
  calcBitTiming();
  renderFaultList();
})();
