// 由 Apple Music（iTunes Lookup API）產生 songs.js。
//
// 用法：node tools/build_songs.mjs
//
// LIST 是人工挑選的題庫：[appleId, 時期, 專輯（顯示用）, 年份, 歌名（可省略，預設用 Apple 的曲名）]
// 全部取自聯合公園自己的錄音室專輯／單曲，不會比對到翻唱。
// 注意：挑戰連結用 SONGS 的索引記錄題目，上線後新歌只能加在 LIST 最後面，不要刪除或重新排序。
import { writeFileSync } from 'node:fs';

const HT = 'Hybrid Theory', MT = 'Meteora', M2M = 'Minutes to Midnight', ATS = 'A Thousand Suns',
  LT = 'Living Things', THP = 'The Hunting Party', OML = 'One More Light', FZ = 'From Zero';

const LIST = [
  // Hybrid Theory（2000）
  [528436568, 'classic', HT, 2000], [528437411, 'classic', HT, 2000], [528437421, 'classic', HT, 2000],
  [528437424, 'classic', HT, 2000], [528437426, 'classic', HT, 2000], [528437609, 'classic', HT, 2000],
  [528437611, 'classic', HT, 2000], [528437613, 'classic', HT, 2000], [528437708, 'classic', HT, 2000],
  [528437709, 'classic', HT, 2000], [528437711, 'classic', HT, 2000],
  // Meteora（2003）
  [528436985, 'classic', MT, 2003], [528437020, 'classic', MT, 2003], [528437021, 'classic', MT, 2003],
  [528437022, 'classic', MT, 2003], [528437023, 'classic', MT, 2003], [528437024, 'classic', MT, 2003],
  [528437025, 'classic', MT, 2003], [528437026, 'classic', MT, 2003], [528437027, 'classic', MT, 2003],
  [528437028, 'classic', MT, 2003], [528437514, 'classic', MT, 2003],
  // Collision Course（2004）與 Meteora 20 週年未發表曲（2023）
  [182601389, 'classic', 'Collision Course（with JAY-Z）', 2004, 'Numb / Encore'],
  [1745057818, 'classic', 'Meteora 20th Anniversary', 2023, 'Lost'],
  // Minutes to Midnight（2007）
  [528975364, 'middle', M2M, 2007], [528975365, 'middle', M2M, 2007], [528975366, 'middle', M2M, 2007],
  [528975367, 'middle', M2M, 2007], [528975368, 'middle', M2M, 2007], [528975409, 'middle', M2M, 2007],
  [528975410, 'middle', M2M, 2007], [528975411, 'middle', M2M, 2007], [528975413, 'middle', M2M, 2007],
  [528975414, 'middle', M2M, 2007],
  // New Divide（2009，變形金剛：復仇之戰）
  [852203669, 'middle', 'New Divide（單曲）', 2009],
  // A Thousand Suns（2010）
  [528969710, 'middle', ATS, 2010], [528969712, 'middle', ATS, 2010], [528969713, 'middle', ATS, 2010],
  [528969715, 'middle', ATS, 2010], [528969716, 'middle', ATS, 2010], [528969717, 'middle', ATS, 2010],
  [528969719, 'middle', ATS, 2010], [528969721, 'middle', ATS, 2010], [528969722, 'middle', ATS, 2010],
  // LIVING THINGS（2012）
  [518869935, 'middle', LT, 2012, 'Lost in the Echo'], [518869936, 'middle', LT, 2012, 'In My Remains'],
  [518869937, 'middle', LT, 2012, 'Burn It Down'], [518869938, 'middle', LT, 2012, 'Lies Greed Misery'],
  [518869939, 'middle', LT, 2012, "I'll Be Gone"], [518869940, 'middle', LT, 2012, 'Castle of Glass'],
  [518869941, 'middle', LT, 2012, 'Victimized'], [518869942, 'middle', LT, 2012, 'Roads Untraveled'],
  [518869943, 'middle', LT, 2012, 'Skin to Bone'], [518869944, 'middle', LT, 2012, 'Until It Breaks'],
  [518869946, 'middle', LT, 2012, 'Powerless'],
  // The Hunting Party（2014）
  [873395043, 'middle', THP, 2014], [873395044, 'middle', THP, 2014], [873395045, 'middle', THP, 2014],
  [873395047, 'middle', THP, 2014], [873395048, 'middle', THP, 2014], [873395054, 'middle', THP, 2014],
  [873395057, 'middle', THP, 2014], [873395058, 'middle', THP, 2014], [873395060, 'middle', THP, 2014],
  [873395061, 'middle', THP, 2014, 'A Line in the Sand'],
  // One More Light（2017）
  [1204427652, 'middle', OML, 2017], [1204427653, 'middle', OML, 2017], [1204427654, 'middle', OML, 2017],
  [1204427655, 'middle', OML, 2017], [1204427656, 'middle', OML, 2017], [1204427657, 'middle', OML, 2017],
  [1204427658, 'middle', OML, 2017], [1204427659, 'middle', OML, 2017], [1204427660, 'middle', OML, 2017],
  [1204427661, 'middle', OML, 2017],
  // From Zero（2024）＋ Deluxe（2025）
  [1801842325, 'new', FZ, 2024], [1801842328, 'new', FZ, 2024], [1801842332, 'new', FZ, 2024],
  [1801842333, 'new', FZ, 2024], [1801842334, 'new', FZ, 2024], [1801842335, 'new', FZ, 2024],
  [1801842336, 'new', FZ, 2024], [1801842339, 'new', FZ, 2024], [1801842340, 'new', FZ, 2024],
  [1801842347, 'new', FZ, 2024],
  [1801842349, 'new', 'From Zero (Deluxe)', 2025], [1801842560, 'new', 'From Zero (Deluxe)', 2025],
  [1801842561, 'new', 'From Zero (Deluxe)', 2025],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ids = LIST.map((x) => x[0]);
const found = new Map();
// Lookup API 一次可查多個 ID
for (let i = 0; i < ids.length; i += 50) {
  const r = await fetch(`https://itunes.apple.com/lookup?country=US&id=${ids.slice(i, i + 50).join(',')}`);
  for (const x of (await r.json()).results) found.set(x.trackId, x);
  await sleep(3200);
}

const out = [];
for (const [appleId, era, album, year, title] of LIST) {
  const x = found.get(appleId);
  if (!x || !x.previewUrl) { console.error(`✗ ${appleId} 找不到或沒有試聽`); continue; }
  // 「Heavy (feat. Kiiara)」→ 歌名 Heavy、合作 Kiiara
  const m = x.trackName.match(/^(.*?)\s*\(feat\. (.+?)\)$/);
  const name = title || (m ? m[1] : x.trackName);
  out.push({ title: name, feat: m ? m[2] : '', album, year, era,
    appleId, preview: x.previewUrl, appleUrl: x.trackViewUrl });
  console.log(`✓ ${name}${m ? ` (feat. ${m[2]})` : ''} — ${album} ｜ Apple：${x.trackName} / ${x.collectionName}`);
}

const titles = out.map((s) => s.title.toLowerCase());
const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
if (dup.length) throw new Error(`歌名重複：${dup.join(', ')}`);

writeFileSync('songs.js', `// 聯合公園題庫：試聽來自 Apple Music（iTunes Lookup API），皆為聯合公園官方錄音室版本。
// 由 tools/build_songs.mjs 產生，請改那裡再重新執行。
// era：classic = Hybrid Theory～Meteora 時期 / middle = Minutes to Midnight～One More Light / new = From Zero
// 挑戰連結用陣列索引記錄題目：新歌只能加在最後面，不要刪除或重新排序。
const SONGS = [
${out.map((s) => '  ' + JSON.stringify(s)).join(',\n')}
];
`);
console.log(`共 ${out.length} 首`);
