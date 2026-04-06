# appセット

Vite + React + TypeScript + React Router + Zustand + react-hook-form + zod + localforage ベースの、展示 + 便利ツール向け local-first 制作環境です。標準サンプルは業務管理画面の見本ではなく、一覧、詳細、軽い編集、保存の機能見本として使います。

## 使い方

- 開発開始: `start.bat` または `npm.cmd run dev`（安全起動設定済み）
- build: `build.bat` または `npm.cmd run build`
- preview: `preview.bat` または `npm.cmd run preview`（安全起動設定済み）
- Electron 起動: `electron-start.bat`（現在の build を開く）
- Electron 開発起動: `npm.cmd run electron:dev`
- 最新の内容を反映したい時は先に `npm.cmd run build`
- ライセンス更新: `npm.cmd run licenses`
- asset 確認: `npm.cmd run assets:verify` と `npm.cmd run assets:report`

## asset 方針

- `core` のみを持つ軽量構成です
- hero、gallery、editor、panel、empty state 用の authored SVG を同梱しています
- 画像や資料を増やす時は `public/assets/core` に置いて、そのまま使えます

## 容量

- テンプレート実測容量: 108.02MB
- 直近 build 後の配布物容量: 0.35MB
- 直近 build の JS 合計: 0.33MB
- asset count: core 19

## 補足

- `start.bat` / `preview.bat` は `--configLoader native` を使う安全起動です
- Electron 追加後も Web 用の `dev` / `build` / `preview` はそのまま使えます
- `window.electronWindow` から最前面固定、最小化、DevTools 切り替えを呼べます
- 小さな常駐ツールを作る時は Electron 側で `BrowserWindow` 設定を調整すると、常に手前に出る小窓へ育てやすいです
- この環境では依存最適化を切っているため、開発サーバー初回表示が少し遅くなることがあります
- appセットは optional を持たず、軽さと中立性を優先しています
- `_asset_cache` は組み立て時の取得キャッシュで、配布やコピーには不要です

## ライセンス

- コード依存のライセンス一覧: `THIRD_PARTY_NOTICES.md`
- 同梱メディア: CC0 1.0 のみ
