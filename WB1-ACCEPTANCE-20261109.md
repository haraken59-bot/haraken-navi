# W-B1 残り受け入れ検証・最終確認（2026-11-09）

## 判定
案件1〜4は今回の限定ローカル検証範囲で合格。GitHub反映・main統合・公開は未実施。PR #12は保留。
既存 work/gps-common-navi-release-20261030 を継続使用。製品コードは今回変更なし。過去の途中結果は WB1-LOCAL-IMPLEMENTATION-20261109.md に履歴として保持する。

## 参照と今回の差分
- 正本：20261109_HarakenNavi_先行バッチWork実装指示書_あんこ_v01.md。
- あんこ：20261109_WB1_CASE1_CASE3_TEST_TRIAGE_ANKO_v01.md（Drive ID 1L9b24j0XLdjCR0yproNQAPtzuldcVSIM）。
- あんこのfixture候補と実物を照合。実際のローカル停止箇所は confirmManualStore の client.stores 不足だった。tests/store-link-search.test.mjs のclientに stores:async()=>[] を1行追加。既存assertを無効化していない。
- 店名順位は既存の純粋関数テスト7assertを再利用。photoStoreSearchはhintをrankPhotoStoresへ渡し、searchPhotoOsmにはpointのみ渡すことを静的確認。実Edge・Overpass通信は行っていない。
- tests/wb1-mood.browser.cjsを受け入れ条件に合わせて修正。配信元127.0.0.1:8140、西新、ゲスト、焼き鳥の合成候補をブラウザのrouteで返す。実際のUI・推薦ロジックを検証し、実検索API・実Authの成功とは区別する。

## 結果
|案件|今回の判定・根拠|
|---|---|
|1 店名ヒント|合格。店名検索テスト完走、純粋順位7assert、外部へhintを渡さない配線の静的確認|
|2 基本定休日|合格。両モードの除外・マスタ引継ぎ等の関連テスト成功。既存当日営業イベントの優先順位は変更なし|
|3 気分入力|合格。下記ブラウザ3項目成功|
|4 推薦理由|合格。未評価ジャンルの量限定理由と既存strong理由の回帰成功|

ブラウザ3項目：同モード再タップで入力・選択・結果保持／モード変更で入力・カテゴリ・結果リセット／「今どうする？」で気分を保持し推薦に利用、すべて成功。
証跡：WB1-MOOD-ACCEPTANCE-20261109.json。推薦結果生成あり、pageerrorなし。検索はブラウザ内合成応答1回、以降は既存キャッシュを使用。実外部検索送信0回。所有するローカルサーバー・ブラウザはfinallyで終了。
前回の「家で…」条件はlocalActionにより候補なし経路へ入るため、今回の店舗候補条件とは異なる。今回の条件で成功したため変更前ビルド比較は未実施。Android・本番APIは未検証。

## 実行コマンドと件数
Node v24.19.0。CIのNode22との実行環境差は残る。
```
node --test tests/store-link-search.test.mjs tests/wb1-recommend.test.mjs tests/specific-dish.test.mjs tests/recommend-specific.test.mjs tests/photo-store-candidates.test.mjs tests/bottle-merge.test.mjs
node tests/wb1-mood.browser.cjs
node --check tests/wb1-mood.browser.cjs
node --check tests/store-link-search.test.mjs
```
- Nodeテストエントリ19成功・0失敗・0skip（bottle6、photo候補5、推薦W-B1 5、残り3ファイル各1）。内部assert数とは区別する。
- ブラウザ受け入れ3項目成功・0失敗。構文確認2ファイル成功。
- 新規失敗0。store-navigationは既知失敗として今回は未実行・未修正。過去成功記録を今回件数に加算しない。

## PR #12（読み取り確認）
Open・Draft・未マージ。head e543a18fe5ccf7f08d163aec4c9a6376ca88ed05。
Actions run 40150984348 / job 121042306482：failure。
syntax、specific dish、recommendation integration、bottle merge成功。Store linking name searchとStore navigation失敗。
これは未変更のリモートheadのCI結果。今回ローカルfixture修正は未pushのためCI改善未確認。store-navigationはNAVI-08／W-B6対象で保持。チェック緩和・無効化・CI再実行なし。

## 保全・残条件
WB1-ACCEPTANCE-BEFORE-20261109.jsonの10ファイルと終了時SHA-256一致：製品6ファイル、store-navigation、workflow、既存GPSテスト2件。DB/SQL・本番・認証情報変更なし。GitHubは読み取りのみ、commit/push/PR更新/merge/deployなし。
今回変更：テスト2ファイル、NAVI_STATUS.md、CHANGELOG.md。新規証跡：本報告、開始時ハッシュJSON、ブラウザ結果JSON。
あんこにはpure ranking／外部hint非送信の配線、ブラウザモック境界、案件2・4の最小差分を独立確認依頼。GitHub反映は変更レビューと承認後。PR12は必要CI成功まで保留。W-B2への移行、W-B6のstore-navigation対応は別判断・別作業とし自動着手しない。
