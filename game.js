/* 聯合公園猜猜看 — 遊戲邏輯
 * 音樂來源：Apple Music（iTunes Search API）官方 30 秒試聽，用網頁內建 <audio> 播放。
 * 不經過 YouTube 播放器，所以沒有廣告，手機鎖定畫面也不會顯示歌名。
 */
(() => {
  'use strict';

  const DIFFICULTY = {
    easy:   { snippet: 15, answerTime: 30 },
    normal: { snippet: 10, answerTime: 25 },
    hard:   { snippet: 5,  answerTime: 20 },
  };
  const DIFF_LABEL = { easy: '簡單', normal: '普通', hard: '困難' };
  const PREVIEW_LEN = 30;        // Apple 試聽長度（秒），實際長度載入後再修正
  const EDGE_IN = 1;             // 試聽開頭的淡入，避開
  const EDGE_OUT = 2.5;          // 試聽結尾的淡出，避開
  const NUDGE_MS = 3000;         // 載入幾毫秒還沒播 → 自動再按一次播放
  const HELP_MS = 5000;          // 載入幾毫秒還沒播 → 顯示「點我播放」
  const LOAD_TIMEOUT_MS = 12000; // 載入逾時 → 重新載入或換歌
  const MAX_ATTEMPTS = 2;        // 每首歌最多載入幾次（第 2 次會先向 Apple 重新取得試聽網址）
  const STALL_MS = 1500;         // 作答中進度停住多久算卡住
  const STALL_HELP_MS = 3000;    // 卡住多久後顯示「點我播放」
  const BEST_KEY = 'lp-guess-best';
  const NAME_KEY = 'lp-guess-name';
  const FAIL_KEY = 'lp-guess-failed';
  const GAME_TITLE = '聯合公園猜猜看';
  const ARTIST = 'LINKIN PARK';
  const artistOf = (s) => (s.feat ? `${ARTIST} feat. ${s.feat}` : ARTIST);
  // 同一首歌的不同版本（Numb 與 Numb / Encore）不能同時當選項
  const baseTitle = (s) => s.title.toLowerCase().split(' / ')[0];
  const MEDIA_ERROR = { 1: '載入被中止', 2: '網路錯誤', 3: '音檔解碼失敗', 4: '音檔無法使用（網址失效或格式不支援）' };
  const songLabel = (s) => `「${s.title}」${s.album}（Apple ${s.appleId}）`;

  /* ---------- 除錯記錄 ----------
   * 載入、播放、錯誤都記在記憶體裡（最多 300 筆），
   * 點頁尾「🐞 播放有問題？」或網址加 ?debug 即可查看並複製給開發者。
   */
  let debugOpen = false;
  const dbg = {
    t0: performance.now(),
    entries: [],
    add(level, msg) {
      const sec = ((performance.now() - this.t0) / 1000).toFixed(1);
      this.entries.push({ sec, level, msg });
      if (this.entries.length > 300) this.entries.shift();
      if (level === 'error' || level === 'warn') console[level](`[猜歌] ${msg}`);
      if (debugOpen) renderDebug();
    },
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    start: $('btn-start'), best: $('best-score'),
    round: $('hud-round'), streak: $('hud-streak'), score: $('hud-score'),
    vinyl: $('vinyl'), labelDisc: $('label-disc'), status: $('cover-status'),
    appleLink: $('reveal-apple'), ytLink: $('reveal-yt'),
    snippetFill: $('snippet-fill'), timerFill: $('timer-fill'),
    replay: $('btn-replay'), options: $('options'),
    reveal: $('reveal'), verdict: $('verdict'), revealTitle: $('reveal-title'), revealMeta: $('reveal-meta'),
    next: $('btn-next'),
    finalScore: $('final-score'), finalCorrect: $('final-correct'), finalStreak: $('final-streak'),
    rank: $('final-rank'), credits: $('credits'), again: $('btn-again'),
    settingsBox: $('settings'), challengeBanner: $('challenge-banner'), challengeText: $('challenge-text'),
    exitChallenge: $('btn-exit-challenge'), challengeResult: $('challenge-result'),
    name: $('player-name'), shareImgBtn: $('btn-share-img'), invite: $('btn-invite'),
    inviteMsg: $('invite-msg'), inviteLink: $('invite-link'),
    modal: $('share-modal'), closeShare: $('btn-close-share'), shareImg: $('share-img'),
    shareIg: $('btn-share-ig'), download: $('btn-download'), shareHint: $('share-hint'),
    unstick: $('btn-unstick'),
    debugOpen: $('btn-debug'), debugModal: $('debug-modal'), debugClose: $('btn-close-debug'),
    debugInfo: $('debug-info'), debugLog: $('debug-log'), debugFailed: $('debug-failed'),
    debugCopy: $('btn-debug-copy'), debugRetry: $('btn-debug-retry'), debugSkip: $('btn-debug-skip'),
    debugClear: $('btn-debug-clear'), debugMsg: $('debug-msg'),
  };

  const settings = { difficulty: 'normal', rounds: 10, pool: 'all' };
  let game = null;   // 本局狀態
  let round = null;  // 本題狀態
  let ticker = null;

  // 同一個 <audio> 元素整局重複使用：第一次在點擊中播放後，手機瀏覽器就允許它之後自動播放
  const audio = new Audio();
  audio.preload = 'auto';
  audio.setAttribute('playsinline', '');
  // 預先下載下一題，切題時幾乎不用等
  const preloader = new Audio();
  preloader.preload = 'auto';
  preloader.muted = true;

  /* ---------- 工具 ---------- */
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const storage = {
    get(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* 無痕模式等情況忽略 */ } },
  };

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === `screen-${name}`));
    window.scrollTo({ top: 0 });
  }

  function renderBest() {
    const best = storage.get(BEST_KEY) || {};
    const b = best[settings.difficulty];
    els.best.textContent = b ? `${DIFF_LABEL[settings.difficulty]}模式最高分：${b}` : '';
  }

  /* ---------- 挑戰連結 ----------
   * 格式：?d=normal&q=3.17.45&s=1230&c=7&n=名字
   * q 是 SONGS 的索引（songs.js 只能往後新增，才不會讓舊連結對到別首歌）
   */
  function parseChallenge() {
    const p = new URLSearchParams(location.search);
    if (!p.has('q')) return null;
    const d = p.get('d');
    if (!DIFFICULTY[d]) return null;
    const q = p.get('q').split('.').map(Number);
    const valid = q.length >= 1 && q.length <= 20 && new Set(q).size === q.length &&
      q.every((i) => Number.isInteger(i) && i >= 0 && i < SONGS.length);
    if (!valid) return null;
    return {
      d,
      songs: q.map((i) => SONGS[i]),
      score: Math.max(0, parseInt(p.get('s'), 10) || 0),
      correct: clamp(parseInt(p.get('c'), 10) || 0, 0, q.length),
      name: (p.get('n') || '').trim().slice(0, 16),
    };
  }

  function buildInviteUrl() {
    const p = new URLSearchParams();
    p.set('d', settings.difficulty);
    p.set('q', game.history.map((h) => SONGS.indexOf(h.song)).join('.'));
    p.set('s', game.score);
    p.set('c', game.correct);
    const name = els.name.value.trim();
    if (name) p.set('n', name);
    return `${location.origin}${location.pathname}?${p}`;
  }

  let challenge = parseChallenge();

  function startLabel() {
    els.start.disabled = false;
    els.start.textContent = challenge ? '接受挑戰' : '開始遊戲';
  }

  function renderChallenge() {
    els.challengeBanner.hidden = !challenge;
    els.settingsBox.hidden = !!challenge;
    if (challenge) {
      settings.difficulty = challenge.d;
      const t = els.challengeText;
      t.textContent = '';
      const who = document.createElement('b');
      who.textContent = challenge.name || '你的朋友';
      const score = document.createElement('b');
      score.textContent = `${challenge.score} 分`;
      t.append(who, ' 邀請你挑戰！', document.createElement('br'),
        `在${DIFF_LABEL[challenge.d]}模式 ${challenge.songs.length} 題中拿下 `, score,
        `（答對 ${challenge.correct} 題）。用同一組題目比比看！`);
    }
    startLabel();
    renderBest();
  }

  function leaveChallenge() {
    challenge = null;
    history.replaceState(null, '', location.pathname);
    // 還原設定按鈕的選取狀態
    document.querySelectorAll('.seg').forEach((seg) => {
      const key = seg.dataset.setting;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(settings[key]) === b.dataset.value));
    });
    renderChallenge();
  }

  /* ---------- 設定 ---------- */
  document.querySelectorAll('.seg').forEach((seg) => {
    seg.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
      const key = seg.dataset.setting;
      settings[key] = key === 'rounds' ? Number(btn.dataset.value) : btn.dataset.value;
      renderBest();
    });
  });
  renderChallenge();
  els.name.value = storage.get(NAME_KEY) || '';

  /* ---------- 手機鎖定畫面／通知列顯示的資訊 ----------
   * 作答中只顯示遊戲名稱與題號，揭曉後才顯示歌名。
   */
  function setMediaInfo(title, artist) {
    if (!('mediaSession' in navigator) || typeof MediaMetadata !== 'function') return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: GAME_TITLE });
    } catch { /* 不支援時忽略 */ }
  }

  /* ---------- 音檔播放 ---------- */
  // 播放並處理瀏覽器擋下自動播放的情況（手機上常見）
  function playAudio(why) {
    const p = audio.play();
    if (p && p.catch) {
      p.catch((err) => {
        if (!round) return;
        dbg.add('warn', `播放被瀏覽器擋下（${why}）：${err.name}`);
        if (err.name === 'NotAllowedError') showUnstick('▶ 點我播放');
      });
    }
  }

  // 用媒體片段（#t=秒數）讓音檔直接從片段起點開始，不會先播出開頭
  function loadSong(song) {
    const url = round.previewUrl || song.preview;
    audio.muted = true;
    audio.src = `${url}#t=${round.snippetStart.toFixed(2)}`;
    audio.load();
    playAudio('載入');
  }

  ['loadstart', 'loadedmetadata', 'canplay', 'playing', 'waiting', 'stalled', 'pause', 'ended'].forEach((type) => {
    audio.addEventListener(type, () => {
      if (round && round.phase !== 'revealed') dbg.add('state', `audio ${type}（${audio.currentTime.toFixed(1)}s）`);
    });
  });

  audio.addEventListener('loadedmetadata', () => {
    if (!round) return;
    // 依實際試聽長度修正片段起點，並確認真的跳到起點
    const dur = audio.duration;
    if (Number.isFinite(dur) && dur > 0) {
      const maxStart = Math.max(0, dur - game.cfg.snippet - EDGE_OUT);
      if (round.snippetStart > maxStart) round.snippetStart = maxStart;
    }
    if (Math.abs(audio.currentTime - round.snippetStart) > 0.5) audio.currentTime = round.snippetStart;
  });

  audio.addEventListener('error', () => {
    if (!round || round.phase === 'skipping') return;
    const code = audio.error && audio.error.code;
    const reason = `音檔錯誤 ${code}：${MEDIA_ERROR[code] || '未知錯誤'}`;
    dbg.add('error', `${songLabel(round.song)} ${reason}`);
    if (round.phase === 'loading') {
      if (round.attempt < MAX_ATTEMPTS) retrySong(reason);
      else failSong(reason);
    } else if (round.phase === 'answering') {
      showUnstick('▶ 播放出錯，點我重試');
    }
  });

  /* ---------- 重新取得試聽網址 ----------
   * Apple 偶爾會更換試聽檔案網址；用 trackId 向 iTunes Lookup API 查詢最新網址（JSONP，不受 CORS 限制）。
   */
  function lookupPreview(id) {
    return new Promise((resolve, reject) => {
      const cb = `itunesCb${Date.now()}`;
      const s = document.createElement('script');
      const timer = setTimeout(() => { cleanup(); reject(new Error('查詢逾時')); }, 6000);
      function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
      window[cb] = (data) => {
        cleanup();
        const r = data && data.results && data.results[0];
        if (r && r.previewUrl) resolve(r.previewUrl); else reject(new Error('Apple 已沒有這首歌的試聽'));
      };
      s.onerror = () => { cleanup(); reject(new Error('無法連到 iTunes')); };
      s.src = `https://itunes.apple.com/lookup?id=${encodeURIComponent(id)}&country=US&callback=${cb}`;
      document.head.appendChild(s);
    });
  }

  /* ---------- 載入失敗處理 ----------
   * 載入中：3 秒沒開始播 → 自動再按一次播放；5 秒 → 顯示「點我播放」按鈕（手機常需要使用者手勢）；
   * 12 秒或音檔錯誤 → 向 Apple 重新取得試聽網址後再載一次；再失敗 → 記錄原因並換下一首。
   * 作答中：播放進度停住 1.5 秒 → 自動重新播放並暫停作答倒數；3 秒 → 顯示「點我播放」按鈕。
   */
  function watchLoading(waited) {
    if (!round.nudged && waited > NUDGE_MS && audio.readyState < 3) {
      round.nudged = true;
      dbg.add('warn', `${Math.round(waited / 1000)} 秒仍未開始播放（readyState ${audio.readyState}），自動重新播放`);
      playAudio('自動重試');
    }
    if (!round.helpShown && waited > HELP_MS) {
      round.helpShown = true;
      els.status.textContent = '音樂載入較慢…';
      if (els.unstick.hidden) showUnstick('▶ 等太久？點我播放');
    }
    if (waited > LOAD_TIMEOUT_MS) {
      const reason = `載入逾時（${Math.round(waited / 1000)} 秒，readyState ${audio.readyState}）`;
      if (round.attempt < MAX_ATTEMPTS) retrySong(reason);
      else failSong(reason);
    }
  }

  async function retrySong(reason) {
    const r = round;
    r.attempt += 1;
    r.phase = 'loading';
    r.retrying = true;
    dbg.add('warn', `${songLabel(r.song)} ${reason}，第 ${r.attempt} 次載入`);
    hideUnstick();
    els.status.textContent = '重新載入中…';
    try {
      r.previewUrl = await lookupPreview(r.song.appleId);
      dbg.add('info', `已向 Apple 重新取得試聽網址${r.previewUrl === r.song.preview ? '（與原本相同）' : '（網址已更新）'}`);
    } catch (e) {
      dbg.add('warn', `重新取得試聽網址失敗：${e.message}，改用原本網址`);
    }
    if (round !== r || r.phase !== 'loading') return;
    Object.assign(r, { loadStartedAt: performance.now(), nudged: false, helpShown: false, retrying: false, seekAt: 0, seekTries: 0 });
    loadSong(r.song);
  }

  function failSong(reason) {
    const song = round.song;
    dbg.add('error', `${songLabel(song)} 無法播放，換下一首（${reason}）`);
    recordFailure(song, reason);
    round.phase = 'skipping';
    game.skipped += 1;
    game.failStreak += 1;
    hideUnstick();
    audio.pause();
    els.status.textContent = '這首播不出來，換下一首…';
    setTimeout(() => { if (round && round.song === song && round.phase === 'skipping') replaceSong(); }, 900);
  }

  function showUnstick(text) {
    els.unstick.textContent = text;
    els.unstick.hidden = false;
  }
  function hideUnstick() { els.unstick.hidden = true; }

  // 使用者點按鈕 = 真正的手勢，瀏覽器一定允許有聲播放
  function unstick() {
    if (!round) return;
    dbg.add('info', `使用者手動播放（${round.phase}，readyState ${audio.readyState}，${audio.paused ? '暫停' : '播放中'}）`);
    hideUnstick();
    if (round.phase === 'answering') {
      audio.muted = false;
      if (!round.snippetPlaying) audio.currentTime = round.snippetStart;
      round.snippetPlaying = true;
      round.lastProgressAt = performance.now();
    } else if (audio.error) {
      // 音檔已經出錯，直接重新載入
      loadSong(round.song);
      return;
    }
    playAudio('手動');
  }

  // 失敗紀錄存在瀏覽器裡，方便從診斷面板看出是哪幾首常出問題
  function recordFailure(song, reason) {
    const all = storage.get(FAIL_KEY) || {};
    const key = String(song.appleId);
    const f = all[key] || { count: 0 };
    all[key] = { count: f.count + 1, reason, at: new Date().toISOString() };
    storage.set(FAIL_KEY, all);
  }

  /* ---------- 遊戲流程 ---------- */
  function newGame() {
    let queue, total;
    if (challenge) {
      // 挑戰模式：同一組題目、同樣順序；後面接備用歌，萬一有歌無法播放時遞補
      settings.difficulty = challenge.d;
      queue = [...challenge.songs, ...shuffle(SONGS.filter((s) => !challenge.songs.includes(s)))];
      total = challenge.songs.length;
    } else {
      queue = shuffle(SONGS.filter((s) => settings.pool === 'all' || s.era === settings.pool));
      total = Math.min(settings.rounds, queue.length);
    }
    game = {
      cfg: DIFFICULTY[settings.difficulty],
      total,
      queue,           // 尚未出題的歌
      index: 0,
      score: 0, streak: 0, bestStreak: 0, correct: 0,
      skipped: 0, failStreak: 0,
      history: [],
    };
    dbg.add('info', `新遊戲：${DIFF_LABEL[settings.difficulty]}、${total} 題${challenge ? '（挑戰模式）' : ''}`);
    showScreen('game');
    startRound();
  }

  function makeOptions(song) {
    const others = [];
    for (const s of shuffle(SONGS)) {
      // 同一首歌的其他版本不能當干擾選項，干擾選項彼此也不重複
      if (baseTitle(s) === baseTitle(song) || others.some((o) => baseTitle(o) === baseTitle(s))) continue;
      others.push(s);
      if (others.length === 3) break;
    }
    return shuffle([song, ...others]);
  }

  function pickStart(snippet) {
    // 試聽通常是副歌附近的 30 秒；在避開淡入淡出的範圍內隨機取片段
    return rand(EDGE_IN, Math.max(EDGE_IN, PREVIEW_LEN - snippet - EDGE_OUT));
  }

  // 必須在使用者點擊（開始遊戲／下一題）的同一個事件裡呼叫，手機才允許播放
  function startRound(song = game.queue.shift()) {
    if (!song) return endGame();
    round = {
      song,
      options: makeOptions(song),
      phase: 'loading',
      loadStartedAt: performance.now(),
      snippetStart: pickStart(game.cfg.snippet),
      snippetPlaying: false,
      answerStartedAt: 0,
      attempt: 1,          // 第幾次載入這首
      previewUrl: null,    // 重新查詢到的試聽網址
      nudged: false,       // 是否已自動重按播放
      helpShown: false,    // 是否已顯示「點我播放」
      lastT: 0, lastProgressAt: 0, lastTickAt: 0,
      stalled: false, stallStart: 0,
      seekAt: 0, seekTries: 0,
    };
    dbg.add('info', `第 ${game.index + 1} 題：${songLabel(song)}，片段從 ${round.snippetStart.toFixed(1)} 秒開始`);

    els.round.textContent = `${game.index + 1} / ${game.total}`;
    els.streak.textContent = game.streak;
    els.score.textContent = game.score;
    els.labelDisc.textContent = '?';
    els.vinyl.classList.remove('spin');
    els.status.textContent = game.failStreak >= 3
      ? `載入音樂中…（已連續 ${game.failStreak} 首播不出來，請檢查網路連線）`
      : '載入音樂中…';
    hideUnstick();
    els.snippetFill.style.width = '0%';
    els.timerFill.style.transform = 'scaleX(1)';
    els.timerFill.classList.remove('warn');
    els.replay.disabled = true;
    els.reveal.hidden = true;
    renderOptions(true);
    setMediaInfo(GAME_TITLE, `第 ${game.index + 1} 題`);

    loadSong(song);
    startTicker();
  }

  function replaceSong() {
    const next = game.queue.shift();
    if (!next) {
      // 題庫用完了，提早結束
      game.total = game.index;
      return endGame();
    }
    startRound(next);
  }

  function preloadNext() {
    const next = game.queue[0];
    if (next && game.index + 1 < game.total) preloader.src = next.preview;
  }

  function renderOptions(disabled) {
    els.options.innerHTML = '';
    round.options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'option';
      b.disabled = disabled;
      b.dataset.en = opt.title;
      b.innerHTML = `<span class="key">${i + 1}</span><span class="zh"></span><span class="en"></span>`;
      b.querySelector('.zh').textContent = opt.title;
      b.querySelector('.en').textContent = `${opt.album}（${opt.year}）`;
      b.addEventListener('click', () => answer(opt));
      els.options.appendChild(b);
    });
  }

  function startTicker() {
    clearInterval(ticker);
    ticker = setInterval(tick, 100);
  }

  function tick() {
    if (!round) return;
    const now = performance.now();

    if (round.phase === 'loading') {
      if (round.retrying) return;
      const t = audio.currentTime;
      // 真的在片段起點附近播放了，才取消靜音開始作答
      if (!audio.paused && audio.readyState >= 3 && t >= round.snippetStart - 0.3 && t < round.snippetStart + 2) {
        round.snippetStart = t;
        audio.muted = false;
        round.phase = 'answering';
        round.snippetPlaying = true;
        round.answerStartedAt = now;
        round.lastT = t;
        round.lastProgressAt = now;
        round.lastTickAt = now;
        game.failStreak = 0;
        hideUnstick();
        dbg.add('info', `片段開始，載入花了 ${((now - round.loadStartedAt) / 1000).toFixed(1)} 秒`);
        els.vinyl.classList.add('spin');
        els.status.textContent = '仔細聽…';
        els.replay.disabled = false;
        renderOptions(false);
        preloadNext();
      } else {
        if (!audio.paused && !audio.seeking && audio.readyState >= 1 &&
            Math.abs(t - round.snippetStart) > 2 && now - round.seekAt > 2000) {
          // 瀏覽器沒有照 #t= 起點播放，手動跳過去（每 2 秒最多一次，避免一直重跳）
          round.seekAt = now;
          round.seekTries += 1;
          dbg.add('warn', `沒有從片段起點播放（目前 ${t.toFixed(1)} 秒），第 ${round.seekTries} 次手動跳到 ${round.snippetStart.toFixed(1)} 秒`);
          if (round.seekTries > 2) {
            // 伺服器不支援跳轉時，改從目前位置開始當作片段
            dbg.add('warn', '無法跳轉，改從目前位置開始');
            round.snippetStart = t;
          } else {
            audio.currentTime = round.snippetStart;
          }
        }
        watchLoading(now - round.loadStartedAt);
      }
      return;
    }

    if (round.phase === 'answering') {
      const dt = now - round.lastTickAt;
      round.lastTickAt = now;

      if (round.snippetPlaying) {
        const t = audio.currentTime;
        if (t > round.lastT + 0.05) {
          round.lastT = t;
          round.lastProgressAt = now;
          if (round.stalled) {
            round.stalled = false;
            dbg.add('info', `恢復播放（卡了 ${((now - round.stallStart) / 1000).toFixed(1)} 秒）`);
            hideUnstick();
            els.vinyl.classList.add('spin');
            els.status.textContent = '仔細聽…';
          }
        } else if (now - round.lastProgressAt > STALL_MS) {
          if (!round.stalled) {
            round.stalled = true;
            round.stallStart = now;
            dbg.add('warn', `播放卡住（${audio.paused ? '暫停' : '緩衝'}，${t.toFixed(1)} 秒），自動重新播放`);
            els.vinyl.classList.remove('spin');
            els.status.textContent = '緩衝中…（作答倒數暫停）';
            playAudio('卡住');
          } else if (now - round.stallStart > STALL_HELP_MS && els.unstick.hidden) {
            showUnstick('▶ 沒聲音？點我播放');
          }
          // 卡住時作答倒數暫停
          round.answerStartedAt += dt;
        }
      }
      // 片段進度
      if (round.snippetPlaying) {
        const ratio = clamp((audio.currentTime - round.snippetStart) / game.cfg.snippet, 0, 1);
        els.snippetFill.style.width = `${ratio * 100}%`;
        if (ratio >= 1 || audio.ended) {
          audio.pause();
          round.snippetPlaying = false;
          els.vinyl.classList.remove('spin');
          els.status.textContent = '片段結束，可以再聽一次';
        }
      }
      // 作答倒數
      const left = 1 - (now - round.answerStartedAt) / (game.cfg.answerTime * 1000);
      els.timerFill.style.transform = `scaleX(${clamp(left, 0, 1)})`;
      els.timerFill.classList.toggle('warn', left < 0.3);
      if (left <= 0) answer(null);
      return;
    }

    if (round.phase === 'revealed' && audio.ended) {
      els.vinyl.classList.remove('spin');
      els.status.textContent = '試聽結束';
    }
  }

  function replay() {
    if (!round || round.phase !== 'answering') return;
    audio.currentTime = round.snippetStart;
    audio.muted = false;
    playAudio('再聽一次');
    round.snippetPlaying = true;
    round.lastT = round.snippetStart;
    round.lastProgressAt = performance.now();
    els.vinyl.classList.add('spin');
    els.status.textContent = '仔細聽…';
  }

  function answer(choice) {
    if (!round || round.phase !== 'answering') return;
    round.phase = 'revealed';
    const song = round.song;
    const ok = choice && choice.title === song.title;
    const left = clamp(1 - (performance.now() - round.answerStartedAt) / (game.cfg.answerTime * 1000), 0, 1);

    let gained = 0;
    if (ok) {
      game.streak += 1;
      game.correct += 1;
      game.bestStreak = Math.max(game.bestStreak, game.streak);
      gained = 100 + Math.round(100 * left) + 20 * Math.min(game.streak - 1, 5);
      game.score += gained;
    } else {
      game.streak = 0;
    }
    game.history.push({ song, ok, gained });

    // 選項標示
    els.options.querySelectorAll('.option').forEach((b) => {
      b.disabled = true;
      if (b.dataset.en === song.title) b.classList.add('correct');
      else if (choice && b.dataset.en === choice.title) b.classList.add('wrong');
      else b.classList.add('dim');
    });

    // 揭曉：從片段起點繼續播放到試聽結束
    hideUnstick();
    els.replay.disabled = true;
    els.labelDisc.textContent = ok ? '✓' : '✗';
    els.vinyl.classList.add('spin');
    els.status.textContent = '♪ 繼續欣賞這首歌';
    els.snippetFill.style.width = '100%';
    audio.currentTime = round.snippetStart;
    audio.muted = false;
    playAudio('揭曉');
    setMediaInfo(song.title, artistOf(song));
    els.appleLink.href = song.appleUrl;
    els.ytLink.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`Linkin Park ${song.title} official`)}`;

    els.verdict.className = `verdict ${ok ? 'ok' : 'no'}`;
    els.verdict.textContent = ok
      ? `答對了！+${gained}${game.streak > 1 ? `（${game.streak} 連擊）` : ''}`
      : choice ? '答錯了！' : '時間到！';
    els.revealTitle.textContent = `「${song.title}」`;
    els.revealMeta.textContent = `${artistOf(song)}｜《${song.album}》（${song.year}）`;
    els.next.textContent = game.index + 1 >= game.total ? '看結果 →' : '下一題 →';
    els.reveal.hidden = false;
    els.streak.textContent = game.streak;
    els.score.textContent = game.score;
    els.next.focus({ preventScroll: true });
  }

  function nextRound() {
    if (!round || round.phase !== 'revealed') return;
    game.index += 1;
    if (game.index >= game.total) return endGame();
    startRound();
  }

  function endGame() {
    clearInterval(ticker);
    audio.pause();
    round = null;
    hideUnstick();
    setMediaInfo(GAME_TITLE, '');
    dbg.add('info', `遊戲結束：${game.score} 分，跳過 ${game.skipped} 首無法播放的歌`);

    const total = game.history.length;
    els.finalScore.textContent = game.score;
    els.finalCorrect.textContent = `${game.correct} / ${total}`;
    els.finalStreak.textContent = game.bestStreak;

    const rate = total ? game.correct / total : 0;
    els.rank.textContent =
      rate === 1 ? '🏆 Soldier 中的 Soldier，In the End 也記得你！' :
      rate >= 0.8 ? '🔥 死忠 LP 歌迷' :
      rate >= 0.5 ? '🎸 演唱會常客' :
      rate >= 0.2 ? '🎧 聽過幾張專輯' : '📀 從 Hybrid Theory 開始補課吧';

    els.credits.innerHTML = '';
    game.history.forEach(({ song, ok, gained }) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="mark ${ok ? 'ok' : 'no'}">${ok ? '✓' : '✗'}</span>
        <span><b></b><small></small></span><a target="_blank" rel="noopener">Apple Music ↗</a>`;
      li.querySelector('b').textContent = `「${song.title}」${ok ? ` +${gained}` : ''}`;
      li.querySelector('small').textContent = `${artistOf(song)}｜《${song.album}》（${song.year}）`;
      li.querySelector('a').href = song.appleUrl;
      els.credits.appendChild(li);
    });

    const best = storage.get(BEST_KEY) || {};
    if (!best[settings.difficulty] || game.score > best[settings.difficulty]) {
      best[settings.difficulty] = game.score;
      storage.set(BEST_KEY, best);
      if (game.score > 0) els.rank.textContent += '　✨ 新紀錄！';
    }

    // 挑戰結果
    els.challengeResult.hidden = !challenge;
    if (challenge) {
      const rival = challenge.name || '朋友';
      const diff = game.score - challenge.score;
      els.challengeResult.textContent =
        diff > 0 ? `🎉 你贏了 ${rival}！（${game.score} vs ${challenge.score}）` :
        diff < 0 ? `😤 差 ${-diff} 分輸給 ${rival}（${game.score} vs ${challenge.score}）` :
        `🤝 和 ${rival} 平手！（${game.score} 分）`;
    }

    els.inviteMsg.textContent = '';
    els.inviteLink.hidden = true;
    showScreen('end');
  }

  /* ---------- 分享成績圖 ---------- */
  let shareBlob = null;
  let shareUrl = null;

  function shareFileName() {
    return `linkinpark-score-${game.score}.png`;
  }

  async function openShare() {
    if (!game) return;
    storage.set(NAME_KEY, els.name.value.trim());
    els.modal.hidden = false;
    els.shareImg.removeAttribute('src');
    els.shareIg.disabled = true;
    els.download.disabled = true;
    els.shareHint.textContent = '產生圖片中…';
    try {
      shareBlob = await window.ShareImage.drawScoreImage({
        name: els.name.value.trim(),
        score: game.score,
        correct: game.correct,
        total: game.history.length,
        bestStreak: game.bestStreak,
        difficultyLabel: DIFF_LABEL[settings.difficulty],
        rank: els.rank.textContent.replace('　✨ 新紀錄！', ''),
        history: game.history,
        inviteUrl: buildInviteUrl(),
        displayUrl: (location.host + location.pathname).replace(/\/$/, ''),
      });
    } catch {
      els.shareHint.textContent = '圖片產生失敗，請再試一次。';
      return;
    }
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareUrl = URL.createObjectURL(shareBlob);
    els.shareImg.src = shareUrl;

    const file = new File([shareBlob], shareFileName(), { type: 'image/png' });
    const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
    els.shareIg.hidden = !canShareFile;
    els.shareIg.disabled = false;
    els.download.disabled = false;
    els.shareHint.textContent = canShareFile
      ? '點「分享到 IG」後選 Instagram → 限時動態；也可以先下載圖片。'
      : '下載圖片後，到 IG 新增限時動態並選擇這張圖片即可分享。';
  }

  function closeShare() {
    els.modal.hidden = true;
  }

  function downloadImage() {
    if (!shareUrl) return;
    const a = document.createElement('a');
    a.href = shareUrl;
    a.download = shareFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    els.shareHint.textContent = '已下載！到 IG 新增限時動態並選擇這張圖片即可分享。';
  }

  async function shareToIg() {
    if (!shareBlob) return;
    const file = new File([shareBlob], shareFileName(), { type: 'image/png' });
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e && e.name === 'AbortError') return; // 使用者取消
      downloadImage();
    }
  }

  /* ---------- 邀請朋友 ---------- */
  async function invite() {
    if (!game) return;
    const name = els.name.value.trim();
    storage.set(NAME_KEY, name);
    const url = buildInviteUrl();
    const text = `${name || '我'}在「${GAME_TITLE}」${DIFF_LABEL[settings.difficulty]}模式拿了 ${game.score} 分（答對 ${game.correct}/${game.history.length}），用同一組題目來挑戰看看，你能贏過我嗎？🎬`;

    els.inviteLink.value = url;
    els.inviteLink.hidden = false;

    if (navigator.share) {
      try {
        await navigator.share({ title: GAME_TITLE, text, url });
        els.inviteMsg.textContent = '已送出邀請！';
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      els.inviteMsg.textContent = '✅ 已複製邀請訊息和連結，貼給朋友吧！';
    } catch {
      els.inviteMsg.textContent = '請複製下面的連結傳給朋友：';
      els.inviteLink.select();
    }
  }

  /* ---------- 診斷面板 ---------- */
  let debugTimer = null;

  function debugInfoLines() {
    const lines = [
      `網址：${location.href}`,
      `瀏覽器：${navigator.userAgent}`,
      `網路：${navigator.onLine ? '連線中' : '離線'}　頁面：${document.hidden ? '背景' : '前景'}`,
    ];
    if (game) lines.push(`本局：第 ${game.index + 1} / ${game.total} 題，已跳過 ${game.skipped} 首，連續失敗 ${game.failStreak} 首`);
    if (round) {
      lines.push(
        `目前歌曲：${songLabel(round.song)}`,
        `階段：${round.phase}　載入次數：${round.attempt}`,
        `音檔：readyState ${audio.readyState}　networkState ${audio.networkState}　${audio.paused ? '暫停' : '播放中'}　${audio.muted ? '靜音' : '有聲'}`,
        `時間：${audio.currentTime.toFixed(1)} / ${Number.isFinite(audio.duration) ? audio.duration.toFixed(1) : '?'} 秒　片段起點：${round.snippetStart.toFixed(1)} 秒`,
        `錯誤：${audio.error ? `${audio.error.code} ${MEDIA_ERROR[audio.error.code] || ''}` : '無'}`,
        `網址：${audio.currentSrc || audio.src}`,
      );
    }
    return lines;
  }

  function failedLines() {
    const all = storage.get(FAIL_KEY) || {};
    return Object.entries(all)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([id, f]) => {
        const s = SONGS.find((x) => String(x.appleId) === id);
        return `${s ? songLabel(s) : id}　失敗 ${f.count} 次，最後原因：${f.reason}`;
      });
  }

  function renderDebug() {
    els.debugInfo.textContent = debugInfoLines().join('\n');
    const failed = failedLines();
    els.debugFailed.textContent = failed.length ? failed.join('\n') : '（沒有記錄）';
    els.debugLog.textContent = dbg.entries.slice().reverse()
      .map((e) => `${e.sec.padStart(6)}s ${{ error: '❌', warn: '⚠️', state: '·', info: 'ℹ️' }[e.level] || ''} ${e.msg}`)
      .join('\n') || '（尚無記錄）';
    els.debugRetry.disabled = !(round && ['loading', 'answering'].includes(round.phase));
    els.debugSkip.disabled = !(round && round.phase === 'loading');
  }

  function openDebug() {
    debugOpen = true;
    els.debugMsg.textContent = '';
    els.debugModal.hidden = false;
    renderDebug();
    clearInterval(debugTimer);
    debugTimer = setInterval(renderDebug, 1000);
  }

  function closeDebug() {
    debugOpen = false;
    els.debugModal.hidden = true;
    clearInterval(debugTimer);
  }

  async function copyDebug() {
    const text = [
      `【${GAME_TITLE} 診斷資訊】${new Date().toLocaleString()}`,
      ...debugInfoLines(), '', '— 失敗過的歌 —', ...failedLines(), '',
      '— 事件記錄 —', ...dbg.entries.map((e) => `${e.sec}s [${e.level}] ${e.msg}`),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      els.debugMsg.textContent = '✅ 已複製，貼給開發者即可';
    } catch {
      els.debugMsg.textContent = '無法自動複製，請手動選取上方文字';
    }
  }

  /* ---------- 事件 ---------- */
  els.start.addEventListener('click', newGame);
  els.again.addEventListener('click', () => {
    if (challenge) leaveChallenge(); else renderBest();
    showScreen('start');
  });
  els.exitChallenge.addEventListener('click', leaveChallenge);
  els.shareImgBtn.addEventListener('click', openShare);
  els.closeShare.addEventListener('click', closeShare);
  els.modal.addEventListener('click', (e) => { if (e.target === els.modal) closeShare(); });
  els.download.addEventListener('click', downloadImage);
  els.shareIg.addEventListener('click', shareToIg);
  els.invite.addEventListener('click', invite);
  els.inviteLink.addEventListener('focus', () => els.inviteLink.select());
  els.name.addEventListener('change', () => storage.set(NAME_KEY, els.name.value.trim()));
  els.replay.addEventListener('click', replay);
  els.next.addEventListener('click', nextRound);
  els.unstick.addEventListener('click', unstick);

  els.debugOpen.addEventListener('click', openDebug);
  els.debugClose.addEventListener('click', closeDebug);
  els.debugModal.addEventListener('click', (e) => { if (e.target === els.debugModal) closeDebug(); });
  els.debugCopy.addEventListener('click', copyDebug);
  els.debugRetry.addEventListener('click', () => {
    if (!round || !['loading', 'answering'].includes(round.phase)) return;
    round.attempt = Math.min(round.attempt, MAX_ATTEMPTS - 1);
    if (round.phase === 'answering') {
      round.snippetPlaying = false;
      renderOptions(true);
      els.replay.disabled = true;
    }
    retrySong('使用者要求重新載入');
    closeDebug();
  });
  els.debugSkip.addEventListener('click', () => {
    if (round && round.phase === 'loading') { failSong('使用者跳過'); closeDebug(); }
  });
  els.debugClear.addEventListener('click', () => { storage.set(FAIL_KEY, {}); renderDebug(); });
  window.addEventListener('online', () => dbg.add('info', '網路已連線'));
  window.addEventListener('offline', () => dbg.add('error', '網路已中斷'));
  document.addEventListener('visibilitychange', () => dbg.add('info', `頁面${document.hidden ? '切到背景' : '回到前景'}`));
  if (new URLSearchParams(location.search).has('debug')) openDebug();

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !els.modal.hidden) return closeShare();
    if (e.key === 'Escape' && debugOpen) return closeDebug();
    if (debugOpen || !round) return;
    if (round.phase === 'answering' && /^[1-4]$/.test(e.key)) {
      answer(round.options[Number(e.key) - 1]);
    } else if (round.phase === 'answering' && (e.key === 'r' || e.key === 'R')) {
      replay();
    } else if (round.phase === 'revealed' && e.key === 'Enter' && document.activeElement !== els.next) {
      nextRound();
    }
  });
})();
