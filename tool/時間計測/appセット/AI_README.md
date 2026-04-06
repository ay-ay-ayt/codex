# AI_README.md

このフォルダは、展示にも便利ツールにも伸ばしやすい local-first アプリ制作環境です。標準サンプルは業務管理画面の見本ではなく、一覧、詳細、軽い編集、保存の機能見本として扱ってください。

## 基本ルール

- `public/assets/core` を優先して使う
- 画面構造は `dashboard / gallery / detail / editor / settings` を維持して差し替えてよい
- 画像や資料を増やす時は `public/assets/core` に置き、`public/assets/manifest.json` と `ASSET_SOURCES.md` を更新する
- 外部 URL を実行時 asset に使わない
- `start.bat` / `build.bat` / `preview.bat` は壊さない
- 起動スクリプトは環境互換性を優先した安全経路を前提にし、`dev` / `preview` の起動方式を安易に戻さない
- 完成時にはワンクリック起動スクリプトも作る

## まず見るファイル

- `src/app/App.tsx`
- `src/app/router`
- `src/app/store/appStore.ts`
- `public/assets/manifest.json`
