# 🎸 聯合公園猜猜看

聽一段 Linkin Park 聯合公園的歌，從四個選項中猜出是哪一首。音樂使用 Apple Music（iTunes API）提供的官方 30 秒試聽，以網頁內建播放器播放——沒有廣告，手機鎖定畫面也只會顯示題號、不會洩漏歌名。

線上遊玩：<https://twtimothylu.github.io/guess_songs_linkinpark/>

## 玩法

- **難度**：簡單（15 秒）／普通（10 秒）／困難（5 秒），片段從 30 秒試聽中隨機截取
- **題數**：5、10、20 題
- **題庫**（共 88 首，全部是聯合公園官方錄音室版本）：
  - 經典（2000–04）：Hybrid Theory、Meteora、Collision Course、Lost
  - 中期（2007–17）：Minutes to Midnight、New Divide、A Thousand Suns、LIVING THINGS、The Hunting Party、One More Light
  - 新篇章（2024–）：From Zero（含 Deluxe）
- 選項下方會顯示專輯與年份
- 計分：答對 100 分 + 速度加分（最多 100）+ 連擊加分；各難度最高分存在瀏覽器中
- 快捷鍵：`1`–`4` 作答、`R` 再聽一次、`Enter` 下一題
- **分享成績圖**：結算頁可產生 IG 限時動態尺寸（1080×1920）的成績圖，含 QR Code
- **邀請朋友挑戰**：產生挑戰連結（`?d=難度&q=題目索引&s=分數&c=答對數&n=名字`），朋友用同一組題目、同樣難度作答。因為連結用的是 `songs.js` 的索引，新增歌曲請只加在最後面
- **播放有問題？**：頁尾的 🐞 按鈕（或網址加 `?debug`）會開啟播放診斷。試聽網址失效時，遊戲會自動向 iTunes Lookup API 重新取得

## 本機執行

```powershell
python -m http.server 8000
```

然後開啟 <http://localhost:8000>。推到 `main` 分支後，GitHub Pages 會自動更新線上版。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 頁面結構（開始／遊戲／結算畫面、分享與診斷視窗） |
| `style.css` | 樣式，支援手機版 |
| `game.js` | 遊戲邏輯、`<audio>` 播放控制與自動修復 |
| `share.js` | 成績分享圖（Canvas 繪製） |
| `songs.js` | 題庫（由 `tools/build_songs.mjs` 產生）：歌名、合作歌手、專輯、年份、時期、Apple Music 試聽 |
| `tools/build_songs.mjs` | 題庫清單（Apple trackId），向 iTunes Lookup API 取得試聽並產生 `songs.js` |

## 新增題目

在 `tools/build_songs.mjs` 的 `LIST` **最後面**加一筆 `[Apple trackId, 時期, 專輯, 年份]`，然後執行：

```powershell
node tools/build_songs.mjs
```

Apple trackId 可以用 `https://itunes.apple.com/lookup?id=148662&entity=song&limit=200` 查（148662 是聯合公園的 Apple 歌手 ID）。

---

試聽由 Apple Music 提供。歌曲版權屬 Linkin Park 及原權利人所有，本專案僅供娛樂與學習用途。
