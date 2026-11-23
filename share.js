/* 聯合公園猜猜看 — 成績分享圖（IG 限時動態尺寸 1080×1920） */
(() => {
  'use strict';

  const W = 1080;
  const H = 1920;
  const C = {
    bg1: '#2b1414', bg2: '#0c0b0b', text: '#f2efea', muted: '#a39c96',
    gold: '#e5383b', gold2: '#ff8a6b', green: '#4cc38a', red: '#e0524a',
    panel: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.12)',
  };
  const SANS = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';
  const SERIF = '"Oswald", "Noto Sans TC", sans-serif';

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  function drawQR(ctx, url, x, y, size) {
    if (typeof qrcode !== 'function') return false;
    try {
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      const n = qr.getModuleCount();
      const quiet = 2;
      const cell = size / (n + quiet * 2);
      ctx.fillStyle = '#fff';
      roundRect(ctx, x, y, size, size, 16);
      ctx.fill();
      ctx.fillStyle = '#0d0b10';
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (qr.isDark(r, c)) {
            ctx.fillRect(
              Math.floor(x + (c + quiet) * cell), Math.floor(y + (r + quiet) * cell),
              Math.ceil(cell), Math.ceil(cell),
            );
          }
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async function loadFonts(text) {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load(`900 80px ${SANS}`, text),
        document.fonts.load(`700 40px ${SANS}`, text),
        document.fonts.load(`400 30px ${SANS}`, text),
        document.fonts.load(`900 200px ${SERIF}`, '0123456789'),
      ]);
    } catch { /* 字型載入失敗就用系統字型 */ }
  }

  /**
   * data: { name, score, correct, total, bestStreak, difficultyLabel, rank,
   *         history: [{ song, ok }], inviteUrl, displayUrl }
   * 回傳 Promise<Blob>（PNG）
   */
  async function drawScoreImage(data) {
    const title = '聯合公園猜猜看';
    const heading = data.name ? `${data.name} 的成績` : '我的成績';
    const rows = data.history.slice(0, 10);
    const allText = [title, heading, data.rank, '總分答對最長連擊難度你能贏過我嗎？掃描用同一組題目挑戰還有首',
      data.difficultyLabel, ...rows.map((h) => h.song.title + h.song.album)].join('');
    await loadFonts(allText);

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // 背景
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, C.bg1);
    bg.addColorStop(0.55, C.bg2);
    bg.addColorStop(1, C.bg2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const spot = ctx.createRadialGradient(W / 2, -100, 0, W / 2, -100, 900);
    spot.addColorStop(0, 'rgba(229,56,59,0.32)');
    spot.addColorStop(1, 'rgba(229,56,59,0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // 標題
    ctx.fillStyle = C.gold;
    ctx.font = `700 30px ${SANS}`;
    ctx.letterSpacing = '12px';
    ctx.fillText('LINKIN PARK', W / 2 + 6, 150);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = C.text;
    ctx.font = `900 84px ${SANS}`;
    ctx.fillText(title, W / 2, 260);
    ctx.fillStyle = C.muted;
    ctx.font = `500 40px ${SANS}`;
    ctx.fillText(fitText(ctx, heading, W - 160), W / 2, 340);

    // 總分
    ctx.fillStyle = C.muted;
    ctx.font = `500 30px ${SANS}`;
    ctx.fillText('總分', W / 2, 430);
    const scoreGrad = ctx.createLinearGradient(0, 440, 0, 610);
    scoreGrad.addColorStop(0, C.gold2);
    scoreGrad.addColorStop(1, C.gold);
    ctx.fillStyle = scoreGrad;
    ctx.font = `900 190px ${SERIF}`;
    ctx.fillText(String(data.score), W / 2, 610);

    // 三格數據
    const stats = [
      ['答對', `${data.correct} / ${data.total}`],
      ['最長連擊', String(data.bestStreak)],
      ['難度', data.difficultyLabel],
    ];
    const boxW = 290, gap = 25, boxY = 660, boxH = 150;
    const startX = (W - (boxW * 3 + gap * 2)) / 2;
    stats.forEach(([label, value], i) => {
      const x = startX + i * (boxW + gap);
      ctx.fillStyle = C.panel;
      roundRect(ctx, x, boxY, boxW, boxH, 24);
      ctx.fill();
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.muted;
      ctx.font = `500 28px ${SANS}`;
      ctx.fillText(label, x + boxW / 2, boxY + 52);
      ctx.fillStyle = C.text;
      ctx.font = `900 52px ${SANS}`;
      ctx.fillText(value, x + boxW / 2, boxY + 118);
    });

    // 稱號
    ctx.fillStyle = C.gold2;
    ctx.font = `700 46px ${SANS}`;
    ctx.fillText(fitText(ctx, data.rank, W - 120), W / 2, 900);

    // 題目清單
    let y = 980;
    const rowH = 58;
    ctx.textAlign = 'left';
    rows.forEach(({ song, ok }) => {
      ctx.fillStyle = ok ? C.green : C.red;
      ctx.font = `900 36px ${SANS}`;
      ctx.fillText(ok ? '✓' : '✗', 110, y);
      ctx.fillStyle = C.text;
      ctx.font = `700 36px ${SANS}`;
      const zh = song.title;
      ctx.fillText(fitText(ctx, zh, 470), 160, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = C.muted;
      ctx.font = `400 26px ${SANS}`;
      ctx.fillText(fitText(ctx, `${song.album}（${song.year}）`, 330), W - 100, y);
      ctx.textAlign = 'left';
      y += rowH;
    });
    if (data.history.length > rows.length) {
      ctx.textAlign = 'center';
      ctx.fillStyle = C.muted;
      ctx.font = `400 28px ${SANS}`;
      ctx.fillText(`…還有 ${data.history.length - rows.length} 首`, W / 2, y);
    }

    // 底部：邀請 + QR Code
    const boxTop = 1600, boxBottom = 1850;
    ctx.fillStyle = 'rgba(230,180,76,0.10)';
    roundRect(ctx, 70, boxTop, W - 140, boxBottom - boxTop, 32);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    ctx.stroke();

    const qrSize = 200;
    const hasQR = drawQR(ctx, data.inviteUrl, 105, boxTop + 25, qrSize);
    const textX = hasQR ? 105 + qrSize + 45 : W / 2;
    ctx.textAlign = hasQR ? 'left' : 'center';
    const maxW = hasQR ? W - 70 - 35 - textX : W - 200;
    ctx.fillStyle = C.text;
    ctx.font = `900 54px ${SANS}`;
    ctx.fillText('你能贏過我嗎？', textX, boxTop + 95);
    ctx.fillStyle = C.muted;
    ctx.font = `400 30px ${SANS}`;
    ctx.fillText(fitText(ctx, hasQR ? '掃描 QR Code，用同一組題目挑戰' : '用同一組題目來挑戰我', maxW), textX, boxTop + 150);
    ctx.fillStyle = C.gold;
    ctx.font = `700 28px ${SANS}`;
    ctx.fillText(fitText(ctx, data.displayUrl, maxW), textX, boxTop + 200);

    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png');
    });
  }

  window.ShareImage = { drawScoreImage };
})();
