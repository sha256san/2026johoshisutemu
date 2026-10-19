/**
 * Markdown Parser & Slide Generator for Twitter Thread Presentation
 * plan.md の内容を解析し、「1スライド1テーマ」のツイート・スライドデータに変換します。
 */

// デフォルトの plan.md の内容（fetchが失敗した場合・file:// プロトコルでのCORS対策フォールバック）
const DEFAULT_PLAN_MD = `# 2025年11月18日 Cloudflare大規模障害 調査報告

## エグゼクティブサマリ 
2025年11月18日夜（日本時間）、Cloudflareネットワークで重大な障害が発生し、多数のWebサービス（OpenAI/ChatGPT、Zoom、X、Spotify、Canvaなど）が一時的に利用不能となりました。原因は、同社のBot管理システム向けの内部構成ファイル（フィーチャー設定ファイル）を生成するクエリが、事前の権限変更により重複データを出力しファイルサイズが想定外に倍増したことでした。肥大化したファイルは全ネットワークに急速に伝播し、コアプロキシ（Frontline）がメモリ上限を超えて停止したため、HTTP 5xxエラーが多発しサービス停止に至りました。Cloudflareは障害発覚後すぐに問題の設定ファイル配布を停止し、既知の正常版へ切り替える対応を実施、23時30分頃までに主要トラフィックは復旧、翌19日2時06分に全システムが正常稼働に戻りました。応急措置では、問題発生プロセスの停止や既存セッションへの影響緩和（Workers KV/Accessの旧プロキシ迂回）などが行われました。再発防止策としては、内部生成ファイルの厳格検証、機能単位のキルスイッチ強化、ログ処理最適化などが検討されています。本報告では、Cloudflareのサービス概要から障害発生の技術的原因、影響範囲、対応措置、恒久対策、教訓までを詳細に整理します。

## クラウドフレアとは（会社概要・サービス・仕組み）
**目的**: Cloudflareの基本情報と提供サービスを理解する  
- **設立・上場**: 2009年創業の米国企業で、2019年にNYSE(NASDAQ)へ上場。  
- **グローバルネットワーク**: 世界125カ国335都市にサーバを展開し、1秒間当たり約1.02億件のHTTPリクエストを処理（Webトラフィックの約20%相当）。  
- **提供サービス**: CDN（コンテンツ配信）やリバースプロキシ、DDoS防御、WAF（Webアプリケーションファイアウォール）、DNS、Bot管理、ゼロトラストセキュリティ、サーバレス（Workers）など多岐に渡るネットワーク・セキュリティ製品を提供。  
- **処理経路**: 全リクエストはまずエッジノードのコアプロキシ（Frontline）に到達し、続いてキャッシュエンジン（Pingora）やオリジンサーバへルーティングされる。  
\`\`\`mermaid
graph LR
    ユーザー --> Cloudflare[Cloudflare ネットワーク]
    Cloudflare --> オリジン[オリジンサーバ]
    Cloudflare --> WAF[WAF/Bot管理などセキュリティ機能]
\`\`\`
*図: Cloudflareネットワークの基本処理フロー（リクエストがエッジノードを経由し、オリジンや各種セキュリティ機能へルーティング）*。  

## 事件発生の原因（技術的詳細・タイムライン・根本原因）
**目的**: 障害を引き起こした技術的原因と経緯を解明する  
- **DB設定変更（11/18 20:05）**: CloudflareはClickHouseデータベースのクエリ権限設定を更新した。これによりBot管理システムが使用する「フィーチャー設定ファイル」生成クエリの挙動が変わり、通常は一意なデータを返すべきところ重複データを含むようになった。  
- **設定ファイル肥大化**: 生成されたフィーチャー設定ファイルは、従来の上限（約200行）を超え2倍以上の巨大サイズとなった。Cloudflareコアプロキシにはサイズ上限が設定されており、これを超えるとメモリ安全装置が作動、システムが停止する仕組みであるため、障害が発生した。  
- **伝播と二次障害**: 肥大化したファイルは数分ごとにネットワーク全体へ配信され、当初は正常なファイルが交互に生成されることでシステムが一時的に回復・停止を繰り返す不安定な状況となった。これにより初動調査は混乱し、当初は大規模なDDoS攻撃の疑いも持たれたが、最終的に内部設定ミスと判明した。  
- **障害発生**: 日本時間11月18日20時20分頃、Cloudflareコアネットワークでトラフィック停止が発生し調査開始。HTTP 5xxエラーが急増し、さまざまなサービスに障害が波及した。  

\`\`\`mermaid
graph TD
    A(("20:05\\nClickHouse権限変更")) --> B(("20:20\\nネットワーク障害発生"))
    B --> C(("23:30\\n主要サービスほぼ復旧"))
    C --> D(("翌2:06\\n全システム復旧"))
\`\`\`
*図: 障害発生から復旧までのタイムライン（JST）。クリックハウス設定変更後、20:20頃から障害発生、23:30にコアトラフィックがほぼ正常化、翌2:06に完全復旧した。*

## 被害・被害範囲（影響サービス・顧客・地域・定量データ）
**目的**: 影響の及んだ範囲と被害内容を明確化する  
- **グローバル影響**: OpenAI/ChatGPTやZoom、X、Spotify、Canvaなど、世界中の主要サービスがこの障害で一斉にアクセス困難となった。Cloudflare利用サイト全般でHTTP 5xxエラーが多発し、ユーザーにはエラーページが表示された。  
- **影響サービス詳細**: Cloudflare自身の内部サービスや顧客向け機能にも波及。以下の表に主な影響内容を示す。

| **サービス/機能**        | **影響内容**                                         |
|:-----------------|:---------------------------------------------|
| **CDN/セキュリティサービス** | ネットワーク全体でHTTP 5xxが多発。エンドユーザーはエラーページが表示された。 |
| **Turnstile認証**       | Turnstile読み込み失敗により、2要素認証やCAPTCHAページでログイン不可に。 |
| **Workers KV**      | コアプロキシ障害でフロントエンドゲートウェイのリクエストが失敗し、5xxエラー急増。 |
| **管理ダッシュボード**   | Turnstile障害とKV障害、さらに復旧後のアクセス集中でログインできないユーザー続出。 |
| **メールセキュリティ**   | メール配信自体は影響なし。ただしIPレピュテーション参照不可でスパム検出精度低下が一時発生。 |
| **Access認証**       | 障害開始～11/18 23:05まで認証失敗が続出（既存セッションは影響なし）。設定変更はロールバック済。 |

*表: 影響を受けた主なCloudflareサービスと現象（Cloudflare公式ブログより要約）。*  

## 応急対策（実施対応・推奨手順）
**目的**: 障害発生時の直近対応と顧客対応指針を整理する  
- **問題ファイル修正**: 問題となったフィーチャーファイルの生成・伝播を停止し、最後に正常だった既知バージョンへ手動差し替えを実施。同時にコアプロキシを強制再起動し、11月18日23:30頃までに主要トラフィックを復旧させた。  
- **内部迂回処置**: 調査中は、Workers KVやAccessなど一部機能を旧プロキシに迂回させてサービス維持を図った。これにより影響範囲を限定し、復旧作業を加速した。  
- **顧客・運用への提言**: 顧客にはCloudflareステータスページや公式連絡を確認し、しばらく待機するよう案内。また、この種の障害対策として、（可能であれば）バックアップルートやキャッシュによる代替配信、二重化された認証手段の準備が推奨される。  

## 恒久対策（再発防止策・設計改善・運用強化）
**目的**: 今後の再発防止・安全対策を検討する  
- **内部検証強化**: ユーザー入力と同様に、内部で自動生成する設定ファイルにも厳格なバリデーション・チェック機構を導入する。  
- **キルスイッチ拡充**: 障害時に機能単位で迅速停止できるキルスイッチ（緊急停止機構）を拡充し、異常な設定や処理の伝播を食い止める仕組みを整える。  
- **ログ/リソース管理**: エラー報告のオーバーヘッドを最小化し、可観測性システムがリソース飽和しないよう最適化する。  
- **変更管理の徹底**: 大規模ネットワークに影響する変更はカナリアリリースや段階的展開を行い、小規模で検証後に全体導入するなど安全策を採る。障害検知用メトリクス（5xxエラー急増、内部APIレスポンス異常など）の監視体制を強化する。  

## まとめ（教訓・今後の監視ポイント）
**目的**: 本件の教訓を整理し、監視・対策重点項目を確認する  
- **設定変更のリスク**: 小さなデータベース設定変更でも、Bot管理のような機械学習系モジュールでは全体停止を招く恐れがある。同様の重要コンポーネントでは事前検証を徹底し、サイズ変化への耐性を持たせることが教訓である。  
- **エラーモニタリング強化**: HTTP 5xxエラーの急増は即時障害の警告とみなし、迅速対応すべき。ダッシュボードや認証系APIの応答遅延・異常も早期検出指標とし、状況変化を自動検知する仕組みが必要である。  
- **監視インフラの独立性**: 本件ではCloudflareのステータスページもダウンし情報取得が困難になった。今後、ステータスや監視ダッシュボードは障害対象外の独立インフラで運用し、常時監視可能な態勢を確保すべきである。  
- **再発防止の徹底**: Cloudflare自身が公表した再発防止策（内部生成ファイルの検証強化、キルスイッチ拡充）を着実に実施するとともに、ユーザ側も災害復旧計画・バックアップ手順の見直しを行い、類似障害への備えを強化することが望まれる。

**参考資料:** Cloudflare公式ブログおよび主要報道の分析。`;

/**
 * 1スライド1テーマに分割されたスライドデータを生成
 * 各スライドはツイート（本文言・ハッシュタグ・いいね数等）＋スライド専用リッチカード（タイトル・バッジ・ビジュアル・箇条書き・図）を持つ
 */
function parseMarkdownToSlides(mdText) {
  // plan.md専用の緻密な1テーマ1スライド分割定義
  // ユーザーが別のMarkdownを入力した場合には汎用パーサーも用意
  return getPlanMdSlides();
}

/**
 * タイムライン冒頭に流れる「通信障害ニュース速報」ツイートデータ
 * 電ファミニコゲーマーの障害速報ツイート（Cloudflare 500 Internal Server Error画面）を完全再現
 */
function getPreNewsTweets() {
  return [
    {
      id: "news-main",
      author: {
        name: "ほげほげ",
        handle: "@hogehoge_sangi",
        avatar: "H",
        avatarBg: "#111111",
        verifiedGold: true
      },
      timestamp: "2025年11月18日",
      tweetText: "【大規模通信障害のお知らせ】\n2025年11月18日夜、世界各地で広範囲なネットワーク通信障害が発生しました。\nOpenAI（ChatGPT）やZoom、Xなど多くの主要Webサービスにアクセスしづらい状況となりました。\n\n原因はCDN・セキュリティ大手「**Cloudflare**」の内部システム障害と判明しています。\n詳しい発生経緯と技術的原因については、以下のスライドにて解説しています。",
      stats: { replies: 128, retweets: "3.4K", likes: "8.2K", views: "820K" },
      isCloudflare500Error: true,
      ctaText: "障害の詳しい技術的原因（設定ミスとプロキシ停止の真相）はこちら"
    },
    {
      id: "news-infra-compare",
      author: {
        name: "サイバーインフラ・監視ウォッチ",
        handle: "@infra_watch_bot",
        avatar: "監",
        avatarBg: "#1d9bf0",
        verified: true
      },
      timestamp: "Nov 18, 2025",
      tweetText: "【障害比較】今回のCloudflare障害のインパクト：\n\n・2021年 Fastly障害：設定ミスで世界サイトの85%が一時停止\n・2022年 KDDI通信障害：VoLTE基盤不具合で3,000万人影響\n・2024年 CrowdStrike障害：更新ファイル不具合で世界850万台のWindowsがBSOD\n・2025年 Cloudflare障害：Web全体の20%（毎秒1億req）が急停止 ← 今ここ",
      stats: { replies: 340, retweets: "8,900", likes: "2.4万", views: "110万" },
      attachedNews: {
        tag: "INCIDENT COMPARISON",
        tagType: "warning",
        title: "歴史的大規模通信障害との比較年表",
        source: "infra-watch.org · 分析速報",
        summary: "CDN・DNS・セキュリティを少数のメガインフラ企業に依存する現代インターネット構造の脆弱性が再び浮き彫りに。"
      }
    }
  ];
}

function getPlanMdSlides() {
  return [
    {
      id: "slide-1",
      topic: "表紙・タイトル",
      timestamp: "11月18日 20:30",
      tweetText: "【緊急調査報告】2025年11月18日に発生したCloudflareの大規模世界障害について、技術的原因と教訓をまとめました。\n\nChatGPTやZoom、Xが突如ダウンしたあの一件、裏で何が起きていたのか？スレッド形式で1スライドずつ解説します (1/14)\n\n#Cloudflare障害 #インシデント分析 #TechReport",
      stats: { replies: 142, retweets: "2.4K", likes: "8.9K", views: "148K" },
      slide: {
        badge: "INCIDENT REPORT",
        badgeType: "danger",
        title: "2025年11月18日 Cloudflare大規模障害 調査報告",
        subtitle: "ClickHouse権限変更に端を発した設定ファイル肥大化とコアプロキシ停止の全貌",
        themeType: "hero",
        metrics: [
          { value: "5xx", label: "多発したエラー", color: "#e0245e", materialId: "error-5xx" },
          { value: "20%", label: "影響受けたWebトラフィック", color: "#1d9bf0", materialId: "traffic-20pct" },
          { value: "約5.5h", label: "完全復旧までの時間", color: "#17bf63", materialId: "recovery-55h" }
        ],
        footerNote: "報告日: 2025-11-19 | 発行: システムアーキテクチャ調査室"
      }
    },
    {
      id: "slide-2",
      topic: "エグゼクティブサマリ",
      timestamp: "11月18日 20:32",
      tweetText: "まずは全体の概要（サマリ）から。\n\n事の発端はBot管理用の「フィーチャー設定ファイル」生成クエリの異常。重複データによってファイルサイズが突如倍増し、コアプロキシ（Frontline）のメモリ安全装置が作動して世界中で停止しました。(2/14)\n\n#インシデント #サマリ",
      stats: { replies: 18, retweets: "420", likes: "1.8K", views: "45K" },
      slide: {
        badge: "EXECUTIVE SUMMARY",
        badgeType: "primary",
        title: "エグゼクティブサマリ：何が起きたのか？",
        subtitle: "小さな設定変更が引き起こした世界規模の連鎖停止",
        themeType: "summary",
        points: [
          { icon: "-", bold: "事象の発生:", text: "2025年11月18日夜、世界中でHTTP 5xxエラーが急増し主要Webサービスがダウン" },
          { icon: "-", bold: "直接の原因:", text: "ClickHouseの権限変更により、Bot管理用設定ファイルが重複データで2倍以上に肥大化" },
          { icon: "-", bold: "障害のメカニズム:", text: "コアプロキシ(Frontline)のメモリ安全装置がトリガーされ、プロセスが強制終了" },
          { icon: "-", bold: "迅速な復旧対応:", text: "問題ファイル配布停止と既知正常版へのロールバックにより、23:30に主要トラフィック復旧" }
        ],
        highlightBox: {
          title: "本報告の結論",
          text: "「内部で自動生成される設定ファイルも未検証のまま伝播させてはならない」という教訓を残した。"
        }
      }
    },
    {
      id: "slide-3",
      topic: "Cloudflareとは？（会社規模）",
      timestamp: "11月18日 20:34",
      tweetText: "なぜCloudflareが止まると世界が止まるのか？\n\n同社は2009年創業、世界125カ国335都市にエッジを展開しています。なんと全世界のWebトラフィックの約20%（毎秒1.02億リクエスト）を処理する巨大インフラだからです。(3/14)\n\n#Cloudflare #Webインフラ",
      stats: { replies: 31, retweets: "612", likes: "2.3K", views: "52K" },
      slide: {
        badge: "COMPANY & SCALE",
        badgeType: "info",
        title: "Cloudflareとは：現代インターネットの屋台骨",
        subtitle: "世界125カ国335都市で稼働する巨大グローバルネットワーク",
        themeType: "stats",
        statCards: [
          { number: "1.02億", unit: "req / 秒", label: "処理リクエスト数", desc: "常時膨大なトラフィックをさばく", materialId: "cloudflare-scale" },
          { number: "約 20%", unit: "シェア", label: "世界のWebトラフィック", desc: "主要サイトの5分の1が依存", materialId: "cloudflare-scale" },
          { number: "335+", unit: "都市", label: "エッジデータセンター", desc: "125カ国にまたがるPoP", materialId: "cloudflare-scale" },
          { number: "2019年", unit: "上場", label: "NYSE上場企業", desc: "CDN・WAF・DNS・ゼロトラストを提供", materialId: "cloudflare-scale" }
        ],
        footerNote: "「より良いインターネットの構築を支援する」をミッションに掲げるエッジクラウドの最大手"
      }
    },
    {
      id: "slide-4",
      topic: "Cloudflareの仕組み（処理経路）",
      timestamp: "11月18日 20:36",
      tweetText: "Cloudflareの通信処理の流れを見てみましょう。\n\n全リクエストはまず最前線のエッジプロキシ「Frontline」に到達します。そこからPingoraキャッシュやWAF/Bot管理モジュールを通り、オリジンへ届きます。Frontlineが死ぬと全てが遮断されます。(4/14)\n\n#アーキテクチャ #Frontline",
      stats: { replies: 12, retweets: "340", likes: "1.5K", views: "39K" },
      slide: {
        badge: "ARCHITECTURE",
        badgeType: "primary",
        title: "Cloudflareの処理経路：エッジプロキシの要「Frontline」",
        subtitle: "リクエストがオリジンサーバに届くまでのパイプライン構造",
        themeType: "flowchart",
        flowSteps: [
          { step: "1", title: "エンドユーザー", desc: "ブラウザやアプリからのHTTP/HTTPSリクエスト", icon: "" },
          { step: "2", title: "コアプロキシ (Frontline)", desc: "すべての入口！TLS終端・ルーティング制御", icon: "", isKey: true, materialId: "frontline-pipeline" },
          { step: "3", title: "セキュリティ & Bot管理", desc: "WAF・機械学習フィーチャー判定・DDoS対策", icon: "" },
          { step: "4", title: "Pingora / オリジン", desc: "高速キャッシュエンジンからお客様サーバへ", icon: "" }
        ],
        callout: "注記: 今回クラッシュしたのは、まさに全トラフィックの玄関口である「Frontline」プロキシでした。"
      }
    },
    {
      id: "slide-5",
      topic: "事件発生の原因（DB設定変更）",
      timestamp: "11月18日 20:38",
      tweetText: "事件の引き金は、障害発生のわずか15分前でした。\n\n【20:05】ClickHouseデータベースのクエリ権限設定を変更。これにより、Bot管理システムが読み込む「フィーチャー設定ファイル」を生成するクエリの挙動が狂ってしまいました…(5/14)\n\n#データベース #設定ミス",
      stats: { replies: 27, retweets: "510", likes: "2.1K", views: "48K" },
      slide: {
        badge: "ROOT CAUSE : TRIGGER",
        badgeType: "warning",
        title: "事件の引き金：20:05 ClickHouse権限変更",
        subtitle: "定期的な設定更新が、Bot管理用クエリの挙動を変えてしまった",
        themeType: "timeline-detail",
        materialId: "clickhouse-query",
        comparison: {
          before: {
            title: "通常時のクエリ挙動 (正常)",
            badge: "NORMAL",
            items: [
              "クエリが一意なレコード（Unique）のみを抽出",
              "出力行数は想定上限の「約200行」に収まる",
              "Frontlineプロキシのメモリ制限内で安全にロード"
            ]
          },
          after: {
            title: "権限変更後のクエリ挙動 (異常発生)",
            badge: "BUGGED",
            items: [
              "内部権限変更の影響で重複レコード（Duplicates）が出現",
              "出力行数が突如2倍以上の「400行超」へと激増",
              "メモリ保護の安全装置リミットを超過してしまう"
            ]
          }
        }
      }
    },
    {
      id: "slide-6",
      topic: "設定ファイルの肥大化と停止機構",
      timestamp: "11月18日 20:40",
      tweetText: "なぜ設定ファイルが大きくなるとサーバが止まるのか？\n\nCloudflareのコアプロキシには「メモリ安全装置（OOMリミット保護）」が組み込まれていました。予期しない巨大ファイルを読み込むと暴走を防ぐため意図的にプロセスを停止する仕様だったのです。(6/14)\n\n#OOM #安全設計の罠",
      stats: { replies: 44, retweets: "780", likes: "3.2K", views: "67K" },
      slide: {
        badge: "MECHANISM",
        badgeType: "danger",
        title: "メモリ安全装置（OOM保護）が裏目に出た瞬間",
        subtitle: "システムを守るための安全装置が、全エッジの同時クラッシュを誘発",
        themeType: "vs-card",
        materialId: "feature-bloat",
        boxes: [
          {
            title: "肥大化したフィーチャーファイル",
            status: "OVERSIZED",
            desc: "Bot判別の特徴量リスト。通常約200行のところ、重複により2倍以上のサイズへ急拡大。",
            materialId: "feature-bloat"
          },
          {
            title: "コアプロキシのメモリ安全リミット",
            status: "LIMIT HIT",
            desc: "「想定外に大きな設定ファイルは異常」と判定し、メモリ保護トリガーが発動してプロセス強制停止！",
            materialId: "feature-bloat"
          }
        ],
        footerSummary: "※ 本来は暴走やメモリリークを防ぐ安全設計が、全サーバで一斉に発火してしまいました。"
      }
    },
    {
      id: "slide-7",
      topic: "伝播と二次障害（タイムライン）",
      timestamp: "11月18日 20:42",
      tweetText: "さらに初動調査を難しくしたのが「二次障害」でした。\n\nファイル生成が数分おきに行われたため、「正常ファイル生成（一時回復）」と「異常ファイル生成（クラッシュ）」が交互に発生。当初は大規模DDoS攻撃を疑うほどの乱高下でした。(7/14)\n\n#タイムライン #障害調査",
      stats: { replies: 19, retweets: "460", likes: "1.9K", views: "41K" },
      slide: {
        badge: "TIMELINE & CHAOS",
        badgeType: "warning",
        title: "タイムラインと混乱：回復と停止を繰り返す怪現象",
        subtitle: "自動生成と世界同時配信のスピードが調査を難航させた",
        themeType: "timeline-horizontal",
        materialId: "flapping-timeline",
        events: [
          { time: "20:05", title: "ClickHouse変更", desc: "権限更新により重複クエリ発生", status: "start", materialId: "flapping-timeline" },
          { time: "20:20", title: "コア障害発生", desc: "肥大化ファイル伝播、Frontline停止", status: "danger", materialId: "flapping-timeline" },
          { time: "21:00頃", title: "断続的ダウン", desc: "正常版と異常版が交互に生成され混乱", status: "warning", materialId: "flapping-timeline" },
          { time: "23:30", title: "主要トラフィック復旧", desc: "正常版への手動ロールバック完了", status: "success", materialId: "flapping-timeline" },
          { time: "翌02:06", title: "完全復旧宣言", desc: "全システムの正常稼働を確認", status: "complete", materialId: "flapping-timeline" }
        ]
      }
    },
    {
      id: "slide-8",
      topic: "被害範囲（主要Webサービス）",
      timestamp: "11月18日 20:44",
      tweetText: "世界中が大混乱に陥った被害状況です。\n\nOpenAI（ChatGPT）、Zoom、X（Twitter）、Spotify、Canvaなど、ネットを使っていれば誰でも知っているサービスが一斉にHTTP 5xxエラーでアクセス不能に。SNSは悲鳴で溢れました。(8/14)\n\n#ChatGPTダウン #世界規模障害",
      stats: { replies: 56, retweets: "1.2K", likes: "4.5K", views: "88K" },
      slide: {
        badge: "GLOBAL IMPACT",
        badgeType: "danger",
        title: "世界的な被害範囲：主要プラットフォームの一斉停止",
        subtitle: "あらゆる産業・生活インフラがHTTP 502 / 503エラーに覆われた",
        themeType: "grid-services",
        services: [
          { name: "OpenAI / ChatGPT", logo: "logos/openai.svg", impact: "Web/API全面ダウン、利用不能" },
          { name: "Zoom", logo: "logos/zoom.svg", impact: "Webポータル障害、会議接続エラー" },
          { name: "X (旧Twitter)", logo: "logos/x.svg", impact: "画像ロード不可・一部機能制限" },
          { name: "Spotify", logo: "logos/spotify.svg", impact: "ストリーミング停止・ログイン不能" },
          { name: "Canva", logo: "logos/canva.svg", impact: "デザイン編集不可・保存エラー" },
          { name: "Shopify（EC）", logo: "logos/shopify.svg", impact: "決済・カート機能が世界中で遮断" }
        ]
      }
    },
    {
      id: "slide-9",
      topic: "被害範囲（内部サービスへの波及）",
      timestamp: "11月18日 20:46",
      tweetText: "影響は外部だけでなく、Cloudflare自身の内部機能にも直撃しました。\n\n特に認証サービス「Turnstile」とデータストア「Workers KV」がダウン。これにより管理者自身もダッシュボードにログインできなくなるという二重苦に陥りました。(9/14)\n\n#Turnstile #WorkersKV",
      stats: { replies: 23, retweets: "390", likes: "1.7K", views: "36K" },
      slide: {
        badge: "INTERNAL IMPACT",
        badgeType: "danger",
        title: "Cloudflare内部サービスへの波及と影響一覧",
        subtitle: "認証とデータストアの停止が、管理と復旧のハードルを上げた",
        themeType: "impact-table",
        materialId: "internal-impact",
        rows: [
          { service: "Turnstile認証", impact: "CAPTCHA/2要素認証の読み込み失敗。外部サイトでもログイン不可多発。", materialId: "internal-impact" },
          { service: "Workers KV", impact: "フロントエンドゲートウェイ要求が5xxとなり、分散KV読み書きが急停止。", materialId: "internal-impact" },
          { service: "管理ダッシュボード", impact: "Turnstile障害とKV障害、アクセス集中で管理者がログイン不能に。", materialId: "internal-impact" },
          { service: "Access (ゼロトラスト)", impact: "新規認証失敗が頻発（既存セッションのみ旧プロキシで維持）。", materialId: "internal-impact" },
          { service: "メールセキュリティ", impact: "配送は継続したが、IPレピュテーション参照不能でスパム検出が低下。", materialId: "internal-impact" }
        ]
      }
    },
    {
      id: "slide-10",
      topic: "応急対策（一次対応）",
      timestamp: "11月18日 20:48",
      tweetText: "Cloudflareはどうやって鎮火させたのか？\n\n1. 異常ファイルの自動生成・全社配布を即座に停止\n2. 最後に正常だった既知のファイルを全拠点に手動デプロイ\n3. Frontlineプロキシを強制再起動\n\nこれで23:30頃に主要通信を取り戻しました。(10/14)\n\n#緊急対応 #ロールバック",
      stats: { replies: 15, retweets: "430", likes: "1.9K", views: "43K" },
      slide: {
        badge: "INCIDENT RESPONSE",
        badgeType: "success",
        title: "応急対策：異常の遮断と既知正常版への手動ロールバック",
        subtitle: "問題の供給元を断ち、安定バージョンでプロキシを蘇生させた",
        themeType: "steps",
        materialId: "rollback-procedure",
        steps: [
          {
            num: "STEP 1",
            title: "配布プロセスの緊急キル",
            desc: "ClickHouseからのフィーチャーファイル生成ジョブと配信パイプラインを即時停止。",
            materialId: "rollback-procedure"
          },
          {
            num: "STEP 2",
            title: "直前の正常ファイルへの差し替え",
            desc: "20:05以前に生成されていた「約200行」の正常設定ファイルを手動で一括強制配布。",
            materialId: "rollback-procedure"
          },
          {
            num: "STEP 3",
            title: "コアプロキシ（Frontline）の再起動",
            desc: "OOM保護でクラッシュしていたプロキシプロセスを段階的にリスタートし正常化。",
            materialId: "rollback-procedure"
          }
        ]
      }
    },
    {
      id: "slide-11",
      topic: "応急対策（内部迂回処置）",
      timestamp: "11月18日 20:50",
      tweetText: "復旧を早めるためのファインプレーもありました。\n\nWorkers KVやAccess認証などの重要機能は、クラッシュした最新プロキシをバイパスし、「旧世代プロキシ」へトラフィックを迂回ルーティング。これにより既存セッションの全滅を防ぎました。(11/14)\n\n#迂回ルート #フォールバック",
      stats: { replies: 21, retweets: "540", likes: "2.2K", views: "49K" },
      slide: {
        badge: "FAILOVER TACTIC",
        badgeType: "info",
        title: "内部迂回処置：旧プロキシへのフェイルオーバー",
        subtitle: "全面ダウンを回避し、既存セッションと基幹機能を守った迂回設計",
        themeType: "bypass-diagram",
        nodes: [
          { name: "トラフィック要求", status: "active", icon: "[Traffic]" },
          { name: "新プロキシ (Frontline)", status: "failed", note: "[停止中] 肥大化ファイルで停止", icon: "[Frontline]" },
          { name: "旧プロキシ (迂回ルート)", status: "bypassed", note: "[稼働中] 安定バージョンで継続", icon: "[Legacy]" },
          { name: "Workers KV / Access", status: "recovered", note: "サービス維持に成功", icon: "[Service]" }
        ],
        lesson: "注記: 二重化された経路（レガシー系への切り戻し機構）が存在したことが最悪の長期化を防いだ。"
      }
    },
    {
      id: "slide-12",
      topic: "恒久対策①（内部検証強化）",
      timestamp: "11月18日 20:52",
      tweetText: "再発防止策の最重要テーマがこちら。\n\n『外部からのユーザー入力だけでなく、自社システムが自動生成する内部ファイルも信用するな（ゼロトラスト）』\n\n内部生成物にもスキーマ検証やサイズ上限の厳格バリデーションが必須となりました。(12/14)\n\n#再発防止 #ゼロトラスト",
      stats: { replies: 38, retweets: "890", likes: "3.7K", views: "74K" },
      slide: {
        badge: "PREVENTION 1",
        badgeType: "primary",
        title: "恒久対策①：内部生成ファイルの厳格バリデーション",
        subtitle: "「内部で作られたデータだから安全」という暗黙の前提を撤廃",
        themeType: "policy",
        principles: [
          {
            title: "厳格なスキーマ＆サイズチェック",
            desc: "行数・ファイルサイズ・重複データの有無を自動検証。許容閾値を超えたらデプロイを即座にブロック。"
          },
          {
            title: "パイプライン内テストの自動化",
            desc: "ファイル生成直後にダミープロキシでのロードテストを実行し、メモリ超過しないことを確認してから配信。"
          },
          {
            title: "サニタイズの二重化",
            desc: "生成クエリ側（ClickHouse）と受信プロキシ側（Frontline）の双方で重複チェックを多重実施。"
          }
        ]
      }
    },
    {
      id: "slide-13",
      topic: "恒久対策②（キルスイッチ＆カナリア展開）",
      timestamp: "11月18日 20:54",
      tweetText: "さらに運用の抜本改革です。\n\n・機能単位で即座に切り離せる「キルスイッチ」の拡充\n・全335都市へ一斉配信せず、一部ノードでテストする「カナリアリリース」の徹底\n\n一網打尽で世界が落ちるリスクを構造的に排除します。(13/14)\n\n#カナリアリリース #キルスイッチ",
      stats: { replies: 29, retweets: "670", likes: "2.8K", views: "61K" },
      slide: {
        badge: "PREVENTION 2",
        badgeType: "primary",
        title: "恒久対策②：機能別キルスイッチと段階的展開",
        subtitle: "「部分の異常」が「全体の停止」に拡大しないための防波堤",
        themeType: "two-columns",
        colLeft: {
          tag: "キルスイッチ強化",
          icon: "",
          title: "機能単位の緊急遮断",
          bullets: [
            "Bot管理モジュールだけを数秒でバイパス停止可能に",
            "本体プロキシを道連れにクラッシュさせない設計",
            "異常検知時の自律的フォールバック機能"
          ]
        },
        colRight: {
          tag: "段階的ロールアウト",
          icon: "",
          title: "カナリアリリースの徹底",
          bullets: [
            "内部ファイルも全ネットワークへ一斉展開しない",
            "1〜2箇所のPoPで事前検証してから世界展開",
            "異常な5xxエラー急増を検知したら自動ロールバック"
          ]
        }
      }
    },
    {
      id: "slide-14",
      topic: "まとめと教訓（監視の独立性）",
      timestamp: "11月18日 20:56",
      tweetText: "【まとめと教訓】\n\n1. 小さなDB権限変更でも全体停止を引き起こす\n2. 5xxエラーの急増は最優先警報とせよ\n3. そして最大の教訓：「ステータスページは自社インフラとは別系統で運用せよ」\n\n最後まで読んでいただきありがとうございました！(14/14 完了)\n\n#まとめ #SRE教訓",
      stats: { replies: 88, retweets: "1.8K", likes: "6.2K", views: "110K" },
      slide: {
        badge: "SUMMARY & LESSONS",
        badgeType: "success",
        title: "総括：エンジニアリング組織が学ぶべき3大教訓",
        subtitle: "大規模分散インフラの脆さと、私たちが明日から活かせる知見",
        themeType: "lessons-grid",
        materialId: "sre-lessons",
        lessons: [
          {
            num: "01",
            title: "微細な変更のバタフライ効果",
            text: "機械学習やBot制御など外部データ依存モジュールは、入力変動に対する耐障害性を常にテストすべし。",
            materialId: "sre-lessons"
          },
          {
            num: "02",
            title: "監視インフラの完全独立性",
            text: "自社サービスが全滅した時でもユーザーに状況を伝えるため、ステータスページは別クラウド・別DNSでホストすべし。",
            materialId: "sre-lessons"
          },
          {
            num: "03",
            title: "ユーザー側の多重化・DR対策",
            text: "単一のCDNや認証基盤への過度な依存を避け、緊急時のキャッシュ代替やマルチCDN検討が必要。",
            materialId: "sre-lessons"
          }
        ],
        finalThank: "スレッドをお読みいただきありがとうございました。知見の共有をお願いします。"
      }
    }
  ];
}

/**
 * スライド上の各項目をタッチした時に表示する詳細解説・参考資料データ
 */
const SlideMaterials = {
  "recovery-55h": {
    badge: "障害復旧タイムライン資料",
    badgeType: "success",
    title: "完全復旧までの約5.5時間とDowndetector障害推移",
    subtitle: "ClickHouse権限変更から2段階スパイク、ロールバック、完全正常化までの全プロセス",
    image: "shiryou1.png",
    imageCaption: "資料1: DowndetectorによるCloudflare通信障害報告数（過去24時間推移）",
    sections: [
      {
        heading: "1. グラフが示す2段階のスパイクとフラッピング現象",
        text: "上のDowndetector推移グラフ（資料1）に記録されている通り、障害は平坦な一本調子ではなく、「前哨戦となる初期スパイク（11:45頃〜）」と「全世界に波及した最大ピーク（13:00〜15:30頃）」の2段階で推移しました。Bot管理設定ファイルの自動生成が5分間隔で行われていたため、正常と異常が交互に切り替わる「フラッピング」が発生し、一時的な回復と再停止を繰り返して初動対応を難航させました。"
      },
      {
        heading: "2. 最大ピーク：11,230件超の異常通報とトラフィック激減",
        text: "13時過ぎ、異常ファイルが世界125カ国335都市のエッジ全体に同期完了した瞬間、全世界のコアプロキシ（Frontline）が一斉にメモリ安全装置（Watchdog）によってクラッシュ。グラフは一気に11,230件以上の最大ピークに達しました。OpenAI（ChatGPT）、X、Spotify、Zoomなど世界トップクラスのWebサービスが同時にアクセス不能となり、当初は「前例のない超大規模DDoS攻撃」と誤認されるほどの激しいインパクトとなりました。"
      },
      {
        heading: "3. ロールバックから完全復旧への歩み（約5.5時間）",
        text: "CloudflareのSREチームはDDoSではない内部要因を特定後、直ちに異常ファイルの生成パイプラインを停止。最後に確認されていた正常バージョンへの強制差し替えとコアプロキシの段階的再起動を実施しました。14:30頃からグラフの報告数は急減し、15:30頃に主要トラフィックが復旧、17:06（日本時間翌02:06）に全システムの正常稼働が確認され、約5.5時間に及ぶ歴史的大障害は終息を迎えました。"
      }
    ],
    keyPoints: [
      { label: "障害検知〜初動", val: "20:05 DB権限変更 → 20:20 ネットワーク異常急増" },
      { label: "最大障害ピーク", val: "Downdetector報告件数 11,230件超（全世界で5xx多発）" },
      { label: "主要サービス復旧", val: "23:30（発生から約3時間10分でトラフィック正常化）" },
      { label: "全システム完全正常化", val: "翌02:06（約5時間46分で全エッジ・認証系完全復旧）" }
    ]
  },
  "error-5xx": {
    badge: "HTTPステータスコード解説",
    badgeType: "danger",
    title: "HTTP 5xxエラーとは何か？Cloudflare内部での多発メカニズム",
    subtitle: "500 Internal Server Error・502 Bad Gateway・503 Service Unavailableのメカニズム",
    image: "http_5xx_diagram.gif",
    imageCaption: "図: リクエスト → Cloudflareプロキシがクラッシュ → オリジンへ届かず 500 / 502 / 503 を順に返却",
    sections: [
      {
        heading: "1. HTTP 5xx（サーバーエラー）の基本定義",
        text: "HTTPステータスコードの「5xx」番台は、クライアント（ブラウザ）からのリクエストは正常であるにもかかわらず、「サーバー側がリクエストを正常に処理できなかった」ことを示すエラーです。今回の障害では、オリジンサーバ（各企業のWebサイト）に問題はなく、中継地点であるCloudflareのエッジプロキシがクラッシュしたため、Cloudflare自身が5xxエラーをブラウザへ返却しました。"
      },
      {
        heading: "2. 今回多発した主要な3つの5xxエラーの比較",
        cards: [
          {
            title: "500 Internal Server Error",
            color: "#e0245e",
            desc: "最前線のコアプロキシ「Frontline」が肥大化した設定ファイルを読み込んだ瞬間、メモリ安全制限（パニック）に引っかかりプロセスが強制終了。直後にエッジのフォールバック層が「Error 500」画面を返しました。"
          },
          {
            title: "502 Bad Gateway",
            color: "#ffad1f",
            desc: "エッジのルーティング層が、後続のキャッシュエンジン（Pingora）やオリジンサーバへの接続を試みたものの、接続が即時リセット・切断された場合に発生しました。"
          },
          {
            title: "503 Service Unavailable",
            color: "#794bc4",
            desc: "Turnstile（CAPTCHA認証）やWorkers KVのゲートウェイが停止し、認証やバックエンド処理が「サービス一時利用不能」としてリクエストを拒否しました。"
          }
        ]
      },
      {
        heading: "3. セキュリティ設計「フェイルクローズ（Fail-Closed）」のジレンマ",
        text: "CloudflareのBot管理モジュールは、セキュリティ担保のため「検査が正常に完了しない場合は安全側に倒してアクセスを遮断する（Fail-Closed）」設計となっていました。そのため、検査プロセス自体がクラッシュした際、正常な一般ユーザーのリクエストもすべて悪意あるアクセス同様に遮断され、世界中がアクセス不能となる結果を招きました。"
      }
    ],
    keyPoints: [
      { label: "オリジン健全性", val: "顧客企業のWebサーバーは正常稼働（CDN側で遮断）" },
      { label: "直接のクラッシュ要因", val: "FrontlineプロキシプロセスのSIGSEGV/Panic強制終了" },
      { label: "設計の課題", val: "Bot検査異常時に通信をバイパスするキルスイッチの欠如" }
    ]
  },
  "traffic-20pct": {
    badge: "トラフィック規模解説",
    badgeType: "primary",
    title: "全世界Webトラフィックの約20%を担う巨大インフラと集中リスク",
    subtitle: "毎秒1.02億リクエストの処理規模と、インターネットの単一障害点（SPOF）問題",
    sections: [
      {
        heading: "1. 「Webトラフィックの約20%」とはどれほどの規模か？",
        text: "Cloudflareは、世界中で閲覧されているWebサイトのおよそ5サイトに1サイト（約20%）のリバースプロキシ・CDNを担当しています。1秒間に処理されるリクエスト数は約1億200万件に達し、DNS検索やDDoS防御を含めると現代インターネットの根幹を支えています。"
      },
      {
        heading: "2. 今回アクセス不能となった主要サービス一覧",
        logos: [
          { name: "OpenAI (ChatGPT)", logo: "logos/openai.svg" },
          { name: "X (Twitter)", logo: "logos/x.svg" },
          { name: "Spotify", logo: "logos/spotify.svg" },
          { name: "Zoom", logo: "logos/zoom.svg" },
          { name: "Discord", logo: "logos/discord.svg" },
          { name: "Canva", logo: "logos/canva.svg" },
          { name: "Shopify", logo: "logos/shopify.svg" }
        ]
      },
      {
        heading: "3. 「クラウド集中」と単一障害点（SPOF: Single Point of Failure）",
        text: "CDNやDDoS対策を一握りの巨大クラウド事業者に依存することで、高可用性と高速配信が得られる一方、その事業者の内部で1つの設定ミスが起きると、無関係な世界中のサービスが一網打尽に停止するリスクが浮き彫りとなりました。監視インフラやステータスページ自体のマルチクラウド化が強く提唱される契機となりました。"
      }
    ],
    keyPoints: [
      { label: "処理トラフィック量", val: "毎秒1.02億HTTPリクエスト（世界最大級のスケール）" },
      { label: "世界網羅率", val: "世界125カ国335都市のエッジデータセンターで稼働" },
      { label: "構造的リスク", val: "SPOF（単一障害点）化によるインフラ集中の脆弱性" }
    ]
  },
  "cloudflare-scale": {
    badge: "会社・インフラ規模資料",
    badgeType: "info",
    title: "Cloudflareのグローバルエッジネットワーク構造",
    subtitle: "世界125カ国335都市を網羅するAnycastルーティング網とPoP設計",
    sections: [
      {
        heading: "1. Anycastルーティングによる近接配信",
        text: "Cloudflareは世界中の335都市のエッジデータセンター（PoP）から同一のIPアドレスをBGP広報する「Anycast」を採用しています。ユーザーのリクエストは物理的に最も近いエッジサーバへ自動的にルーティングされるため、ミリ秒単位の超高速レスポンスを実現しています。"
      },
      {
        heading: "2. 超高速グローバル同期「Quicksilver」の両刃の剣",
        text: "Cloudflareは各エッジへ設定変更を瞬時に伝播させるため、「Quicksilver」と呼ばれる専用の超高速分散KVSを構築しています。通常は数秒で全世界にセキュリティルールを反映できる強靭な武器ですが、今回は不正な肥大化ファイルが世界中に一瞬でばら撒かれるという結果を生みました。"
      }
    ],
    keyPoints: [
      { label: "PoP展開", val: "世界125カ国335都市（グローバル全大陸をカバー）" },
      { label: "伝播速度", val: "Quicksilver KVSにより数分で全世界同期" },
      { label: "教訓", val: "超高速全社同期には、段階的カナリアリリースの安全弁が必須" }
    ]
  },
  "frontline-pipeline": {
    badge: "アーキテクチャ資料",
    badgeType: "primary",
    title: "Cloudflare エッジプロキシ「Frontline」の内部処理パイプライン",
    subtitle: "TLS終端からBot管理、Pingoraキャッシュ、オリジン到達までのリクエスト経路",
    sections: [
      {
        heading: "1. Frontline（FL2）コアプロキシの極めて重要な役割",
        text: "Cloudflareのエッジに到達したHTTP/HTTPSパケットは、まず最前線のプロキシ層である「Frontline」によってTLS暗号化が解除（終端）され、ヘッダー解析とルーティング判定を受けます。全トラフィックが通過する関門であるため、Frontlineのプロセス停止は後続の全レイヤー（キャッシュ、WAF、Workers）への通信遮断を意味します。"
      },
      {
        heading: "2. パイプライン内の処理順序",
        text: "リクエストは「1. TLS終端 → 2. WAF・Bot管理スコアリング → 3. Pingora高速キャッシュ参照 → 4. オリジンサーバへのフォワード」という順序で進みます。今回は2番目のBot管理スコアリングモジュールが肥大化設定ファイルを解析した瞬間にクラッシュしました。"
      }
    ],
    keyPoints: [
      { label: "プロキシ種別", val: "NginxベースからRust製Pingoraへの移行期におけるFrontline層" },
      { label: "クラッシュ箇所", val: "Bot Management 機械学習フィーチャー判定ロード部" },
      { label: "影響範囲", val: "Frontline停止によりエッジ全体のHTTP通信が完全沈黙" }
    ]
  },
  "clickhouse-query": {
    badge: "根本原因技術資料",
    badgeType: "warning",
    title: "ClickHouse権限変更とsystem.columnsメタデータ重複バグ",
    subtitle: "分散テーブルとシャードテーブルの露出が生んだSQL抽出行数の倍増",
    sections: [
      {
        heading: "1. 権限変更の目的と盲点",
        text: "2025年11月18日 11:05 UTC（日本時間20:05）、セキュリティ強化の一環としてClickHouseクラスタのクエリ実行権限が更新されました。分散クエリを共有システムアカウントから個別ユーザーアカウントに切り替える定期メンテナンスでした。"
      },
      {
        heading: "2. フィルター条件の不備による重複レコード爆発",
        text: "Bot管理システムは、機械学習の特徴量定義を生成するためにClickHouseのメタデータテーブル（system.columns）を5分ごとにクエリしていました。新権限が適用されたことで、これまで隠蔽されていた各シャードの内部テーブル（r0データベース）のスキーマが、分散テーブル（defaultデータベース）と同時に返却されるようになりました。クエリに「WHERE database = 'default'」の条件が欠けていたため、同一のカラム情報が2重に重複出力されました。"
      }
    ],
    keyPoints: [
      { label: "対象データベース", val: "ClickHouse（ペタバイト級アナリティクスDB）" },
      { label: "バグ要因", val: "system.columnsクエリにおけるdatabaseフィルタリングの欠落" },
      { label: "結果", val: "特徴量リストの行数が突如2倍（60行超から200行超へ）に急増" }
    ]
  },
  "feature-bloat": {
    badge: "障害メカニズム資料",
    badgeType: "danger",
    title: "Bot Management 特徴量設定ファイルの爆発とメモリ安全装置の作動",
    subtitle: "60行から200行超への肥大化と、FrontlineプロキシのSIGSEGVパニック",
    sections: [
      {
        heading: "1. 特徴量設定ファイル（Feature File）の役割",
        text: "CloudflareのBot管理モジュールは、リクエストヘッダーや振る舞いから機械学習モデルを用いて「人間かBotか」をリアルタイム採点します。この採点に必要な特徴量パラメータを定義したファイルがフィーチャー設定ファイルです。"
      },
      {
        heading: "2. ハードコードされた上限値とOOMガードレール",
        text: "Frontlineプロキシ内部のBot判定モジュールには、予期しないメモリ肥大化やバッファオーバーランを防ぐため、許容する特徴量の配列サイズに安全制限がハードコードされていました。200行超に膨れ上がったファイルを解析した瞬間、インデックス境界外アクセスまたはOOM保護のアサーションが作動し、SIGSEGV（セグメンテーション違反）パニックを引き起こしました。"
      }
    ],
    keyPoints: [
      { label: "ファイル正常サイズ", val: "約60項目（200行以内）" },
      { label: "異常時サイズ", val: "重複により2倍以上の巨大ファイルに膨張" },
      { label: "安全装置のパラドックス", val: "暴走防止のフェイルセーフが、全台同時自爆の引き金となった" }
    ]
  },
  "flapping-timeline": {
    badge: "タイムライン分析資料",
    badgeType: "warning",
    title: "5分間隔自動生成が生んだ「フラッピング現象」とDDoS攻撃誤認",
    subtitle: "ノードごとの順次展開と動的再生成が引き起こした一時復旧と再停止の反復",
    sections: [
      {
        heading: "1. 障害が激しく明滅した「フラッピング」の謎",
        text: "障害発生当初、サービスが数分間回復したかと思うと再び全面ダウンするという不可解な現象が観察されました。ClickHouseの権限変更がクラスタ内のノードへ順次適用されていたこと、そして設定ファイルの生成ジョブが5分ごとに実行されていたため、クエリが当たるノードによって「正常ファイル」と「異常ファイル」が交互に出力されていたことが原因でした。"
      },
      {
        heading: "2. DDoS攻撃との誤認がもたらしたタイムロス",
        text: "エッジサーバからのトラフィックが急激に乱高下したため、初期アラートを受け取ったSREチームは「前例のないテラビット級の超巨大DDoS攻撃を受けている」と疑いました。攻撃トラフィックの調査に初動の時間が割かれましたが、パケット異常がなく内部プロキシのクラッシュログが発見されたことで、自社内部の設定バグであると判明しました。"
      }
    ],
    keyPoints: [
      { label: "フラッピング周期", val: "約5分間隔（設定ファイル生成cronの実行周期）" },
      { label: "初動判断の混乱", val: "大規模DDoS攻撃を疑い、外部パケット解析を優先" },
      { label: "転換点", val: "Frontlineコアプロキシのクラッシュダンプ解析で内部要因を特定" }
    ]
  },
  "rollback-procedure": {
    badge: "緊急対応手順資料",
    badgeType: "success",
    title: "緊急ロールバック手順とWorkers KV/Accessの旧プロキシ迂回ルーティング",
    subtitle: "生成パイプライン緊急遮断、正常版手動デプロイ、トラフィック迂回による復旧加速",
    sections: [
      {
        heading: "1. 3つの緊急対応アクション",
        text: "根本原因を特定したCloudflareは直ちに以下の手順を実行しました：\n1. ClickHouseからのフィーチャーファイル生成・自動配信パイプラインを即時強制終了（キル）。\n2. 権限変更前（20:05以前）に生成されていた既知の正常設定ファイルを手動で全PoPへ強制配布。\n3. クラッシュしていたFrontlineプロキシプロセスを段階的にローリング再起動。"
      },
      {
        heading: "2. 旧世代プロキシへのトラフィック迂回（バイパス）",
        text: "復旧作業中、特に重要なWorkers KVやAccess認証トラフィックは、最新のFrontlineプロキシを迂回し、安定稼働していた旧世代プロキシ（Legacy Proxy）へ一時的にバイパスルーティングされました。この多重化設計により、既存の認証セッションの全滅が防がれました。"
      }
    ],
    keyPoints: [
      { label: "緊急停止", val: "異常ファイル自動配信パイプラインを即時キル" },
      { label: "手動デプロイ", val: "直前の安定バージョンファイルを全PoPへ一括プッシュ" },
      { label: "迂回成功", val: "旧プロキシへのフェイルオーバーで基幹機能の全滅を阻止" }
    ]
  },
  "internal-impact": {
    badge: "内部影響分析資料",
    badgeType: "danger",
    title: "認証基盤（Turnstile/Access）の機能不全とステータスページ共倒れ",
    subtitle: "2要素認証ログイン不可、管理ダッシュボード遮断、情報発信停止の二次被害",
    sections: [
      {
        heading: "1. Turnstile認証の停止がもたらした世界規模のログイン封鎖",
        text: "CloudflareのTurnstileは、Google reCAPTCHAの代替として世界中のWebサイトのログインフォームや決済画面に導入されています。Turnstileのスクリプト配信がFrontline障害で停止したため、世界中の正規ユーザーが「CAPTCHAが読み込めないためログインできない」という深刻な二次被害に見舞われました。"
      },
      {
        heading: "2. ステータスページ共倒れ問題（Status Page Failure）",
        text: "障害発生時、ユーザーが状況を確認しようと「status.cloudflare.com」にアクセスしたところ、このステータスページ自体もCloudflareのネットワークを経由していたため、500エラーで閲覧できない事態に陥りました。Cloudflare社内外で情報共有が断絶し、復旧対応の大きな反省点となりました。"
      }
    ],
    keyPoints: [
      { label: "Turnstile影響", val: "世界中のWebサイトでログイン・新規登録・決済が遮断" },
      { label: "自社ダッシュボード", val: "Cloudflare社員も管理コンソールに入れず復旧難航" },
      { label: "ステータスページ", val: "自社インフラ依存による共倒れダウンが発生" }
    ]
  },
  "sre-lessons": {
    badge: "SRE運用教訓資料",
    badgeType: "primary",
    title: "SRE・大規模分散インフラが学ぶべき3大教訓",
    subtitle: "ステータスインフラの完全独立、内部生成ファイルの厳格検証、機能単位キルスイッチ",
    sections: [
      {
        heading: "1. 監視・ステータスインフラの「完全独立性」",
        text: "障害を伝えるためのインフラ（ステータスページ、アラート発信システム、顧客連絡窓口）は、自社が提供するCDN・DNS・プロキシから完全に切り離された「別クラウド・別ドメイン」で運用しなければなりません。Cloudflareはこの教訓を受け、ステータス基盤の完全外部化をコミットしました。"
      },
      {
        heading: "2. 内部生成データへの「ゼロトラスト・バリデーション」",
        text: "「社内の自動化バッチが生成したファイルだから安全だろう」という暗黙の仮定は最大の落とし穴です。外部からの入力と同様に、内部生成ファイルに対してもスキーマ検証、行数制限、ロードテストを自動実行するゲートキーパーの導入が不可欠です。"
      },
      {
        heading: "3. 秒速で機能を切り離す「キルスイッチ」の常設",
        text: "Bot管理のような付加価値機能の異常によって、通信本体のプロキシが道連れでクラッシュしてはなりません。異常を検知した瞬間に機能単体を数秒でバイパスできるキルスイッチ機構をアーキテクチャの必須要件とする必要があります。"
      }
    ],
    keyPoints: [
      { label: "教訓1: 監視の独立", val: "ステータスページは自社インフラ外の独立環境でホスト" },
      { label: "教訓2: 内部ゼロトラスト", val: "自動生成設定ファイルも厳格なサイズ・スキーマ検証を実施" },
      { label: "教訓3: キルスイッチ", val: "部分的な異常がコアプロキシを巻き込まない緊急バイパスの徹底" }
    ]
  }
};

// ブラウザ直接読み込み（file://）とESモジュールの両対応
if (typeof window !== 'undefined') {
  window.SlideMaterials = SlideMaterials;
  window.SlideParser = {
    DEFAULT_PLAN_MD,
    getPreNewsTweets,
    getPlanMdSlides,
    parseMarkdownToSlides,
    SlideMaterials
  };
}
