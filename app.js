/**
 * Twitter Light Theme Presentation App
 * タイムライン形式のスライドショー、スレッド返信アニメーション、Twitter画像拡大FLIPアニメーション
 */
// モジュール環境と通常スクリプトタグ（file:// 直接オープン）の両対応
const getSlides = () => {
  if (typeof window !== 'undefined' && window.SlideParser) {
    return window.SlideParser.getPlanMdSlides();
  }
  return [];
};
const getDefaultMd = () => {
  if (typeof window !== 'undefined' && window.SlideParser) {
    return window.SlideParser.DEFAULT_PLAN_MD;
  }
  return '';
};

const getNews = () => {
  if (typeof window !== 'undefined' && window.SlideParser) {
    return window.SlideParser.getPreNewsTweets ? window.SlideParser.getPreNewsTweets() : [];
  }
  return [];
};

class SlideDeckApp {
  constructor() {
    this.slidesData = [];
    this.newsData = [];
    this.currentIndex = 0;      // 現在タイムラインに表示されている最新スライドのインデックス
    this.modalIndex = 0;        // モーダルで現在拡大表示しているスライドのインデックス
    this.isPosting = false;      // 返信アニメーション中フラグ
    this.activeSourceCard = null; // ズーム元要素

    this.initElements();
    this.loadData();
    this.bindEvents();
  }

  initElements() {
    this.feedEl = document.getElementById('timelineFeed');
    this.replySectionEl = document.getElementById('threadReplySection');
    this.replyBoxEl = document.getElementById('replyPromptBox');
    this.nextBtn = document.getElementById('nextSlideBtn');
    this.postingLoader = document.getElementById('replyPostingLoader');
    this.completedBanner = document.getElementById('threadCompletedBanner');
    this.progressBarFill = document.getElementById('progressBarFill');
    this.slideProgressText = document.getElementById('slideProgressText');
    this.tocListEl = document.getElementById('slideTocList');

    // Left Navigation Elements
    this.twitterLogoBtn = document.getElementById('twitterLogoBtn');
    this.navHomeBtn = document.getElementById('navHomeBtn');
    this.navExploreBtn = document.getElementById('navExploreBtn');
    this.btnPresentMode = document.getElementById('btnPresentMode');
    this.btnMoreOptions = document.getElementById('btnMoreOptions');
    this.moreOptionsDropdown = document.getElementById('moreOptionsDropdown');
    this.dropResetTl = document.getElementById('dropResetTl');
    this.dropExpandAll = document.getElementById('dropExpandAll');
    this.dropReloadMd = document.getElementById('dropReloadMd');
    this.navPostBtn = document.getElementById('navPostBtn');

    // Controls
    this.btnExpandAll = document.getElementById('btnExpandAll');
    this.btnReset = document.getElementById('btnReset');

    // Modal elements
    this.modalOverlay = document.getElementById('modalOverlay');
    this.modalSlideFrame = document.getElementById('modalSlideFrame');
    this.modalCloseBtn = document.getElementById('modalCloseBtn');
    this.modalPrevBtn = document.getElementById('modalPrevBtn');
    this.modalNextBtn = document.getElementById('modalNextBtn');
    this.modalCounter = document.getElementById('modalSlideCounter');

    // Markdown Modal elements
    this.mdModalOverlay = document.getElementById('mdModalOverlay');
    this.mdTextarea = document.getElementById('mdTextarea');
    this.btnOpenMdModal = document.getElementById('btnOpenMdModal');
    this.btnCloseMdModal = document.getElementById('btnCloseMdModal');
    this.btnApplyMd = document.getElementById('btnApplyMd');
    this.btnLoadPlanMd = document.getElementById('btnLoadPlanMd');

    // Slide Material Modal elements (詳細解説・資料モーダル)
    this.materialModalOverlay = document.getElementById('materialModalOverlay');
    this.materialModalDialog = document.getElementById('materialModalDialog');
    this.matModalBadge = document.getElementById('matModalBadge');
    this.matModalTitle = document.getElementById('matModalTitle');
    this.matModalSubhead = document.getElementById('matModalSubhead');
    this.matModalBody = document.getElementById('matModalBody');
    this.btnCloseMatModal = document.getElementById('btnCloseMatModal');
    this.btnConfirmCloseMatModal = document.getElementById('btnConfirmCloseMatModal');
  }

  loadData() {
    // plan.mdのデータ & ニュース速報ツイート取得
    this.slidesData = getSlides();
    this.newsData = getNews();
    this.resetTimeline();
  }

  resetTimeline() {
    this.currentIndex = 0;
    this.feedEl.innerHTML = '';
    this.completedBanner.classList.remove('active');
    this.replySectionEl.style.display = 'flex';
    this.renderToc();

    // 1. クラウドフレア通信障害と他の歴史的通信障害のニュース速報ツイートをタイムライン先頭に配置
    this.renderPreNewsTweets();

    // 2. 注目スレッド区切りバッジを挿入
    const dividerEl = document.createElement('div');
    dividerEl.className = 'thread-starter-divider';
    dividerEl.innerHTML = `
      <svg style="width:16px;height:16px;fill:currentColor;" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
      <span>公式調査スレッド · Cloudflare大規模障害 調査報告 (1/14)</span>
    `;
    this.feedEl.appendChild(dividerEl);

    // 3. 最初のスライド（表紙ツイート）を表示
    this.appendTweet(0);
    this.updateProgress();

    // 4. スクロール位置を確実に一番上（0, 0）へリセット
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, 50);
  }

  // タイムライン冒頭のニュースツイートを描画
  renderPreNewsTweets() {
    if (!this.newsData || this.newsData.length === 0) return;

    this.newsData.forEach((news) => {
      const newsEl = document.createElement('article');
      newsEl.className = 'tweet-news-item';
      newsEl.id = `tweet-${news.id}`;

      let cardHtml = '';
      
      // 画像で指定された電ファミニコゲーマーの Cloudflare 500 エラー画面カード
      if (news.isCloudflare500Error) {
        cardHtml = `
          <div class="cf-error-media-card" id="cfErrorHeroCard" title="クリックして詳細調査スライド（1/14）を見る">
            <div class="cf-error-hover-hint">
              <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>
              <span>スライドで調査報告を読む</span>
            </div>

            <!-- Top Header -->
            <div class="cf-error-top-banner">
              <div class="cf-error-title-row">
                <span class="cf-error-heading">Internal server error</span>
                <span class="cf-error-code-badge">Error code 500</span>
              </div>
              <div class="cf-error-subtext">Visit <a href="#">cloudflare.com</a> for more information.</div>
              <div class="cf-error-timestamp">2025-11-18 13:04:20 UTC</div>
            </div>

            <!-- Middle Status Flowchart (You / Tokyo Cloudflare / x.com) -->
            <div class="cf-status-graphic-area">
              <!-- Node 1: Browser -->
              <div class="cf-status-node">
                <div class="cf-node-icon-wrapper">
                  <svg class="cf-node-svg" viewBox="0 0 24 24"><path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
                  <div class="cf-node-badge success"><svg viewBox="0 0 12 12" style="width: 10px; height: 10px; fill: white;"><path d="M10 3L4.5 8.5 2 6l1-1 1.5 1.5L9 2l1 1z"/></svg></div>
                </div>
                <div class="cf-node-tag">You</div>
                <div class="cf-node-name">Browser</div>
                <div class="cf-node-status working">Working</div>
              </div>

              <!-- Node 2: Cloudflare (ERROR) -->
              <div class="cf-status-node" style="position: relative;">
                <div class="cf-node-icon-wrapper">
                  <svg class="cf-node-svg" style="fill: #7f8c8d; width: 68px;" viewBox="0 0 24 24"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>
                  <div class="cf-node-badge error"><svg viewBox="0 0 12 12" style="width: 9px; height: 9px; fill: white;"><path d="M9 3L6 6l3 3-1 1-3-3-3 3-1-1 3-3-3-3 1-1 3 3 3-3 1 1z"/></svg></div>
                </div>
                <div class="cf-node-tag">Tokyo</div>
                <div class="cf-node-name" style="color: #2b7bb9; font-weight: 600;">Cloudflare</div>
                <div class="cf-node-status error">Error</div>
                <div class="cf-pointer-triangle"></div>
              </div>

              <!-- Node 3: Host (x.com) -->
              <div class="cf-status-node">
                <div class="cf-node-icon-wrapper">
                  <svg class="cf-node-svg" viewBox="0 0 24 24"><path d="M4 1h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2zm0 8h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/></svg>
                  <div class="cf-node-badge success"><svg viewBox="0 0 12 12" style="width: 10px; height: 10px; fill: white;"><path d="M10 3L4.5 8.5 2 6l1-1 1.5 1.5L9 2l1 1z"/></svg></div>
                </div>
                <div class="cf-node-tag">x.com</div>
                <div class="cf-node-name">Host</div>
                <div class="cf-node-status working">Working</div>
              </div>
            </div>

            <!-- Bottom Explanation -->
            <div class="cf-error-bottom-info">
              <div class="cf-info-col">
                <h5>What happened?</h5>
                <p>There is an internal server error on Cloudflare's network.</p>
              </div>
              <div class="cf-info-col">
                <h5>What can I do?</h5>
                <p>Please try again in a few minutes.</p>
              </div>
            </div>
          </div>

          <!-- Slide lead-in CTA banner -->
          <div class="slide-thread-cta-banner" id="btnLeadToSlide">
            <span class="cta-banner-text">
              <svg style="width:18px;height:18px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              <span>なぜ起きたのか？内部原因とコアプロキシ停止の真相はスレッド解説へ</span>
            </span>
            <span style="font-size:0.8rem; font-weight:800; color:var(--twitter-blue);">スライド1を見る &rarr;</span>
          </div>
        `;
      } else if (news.attachedNews) {
        cardHtml = `
          <div class="news-attached-card">
            <div class="news-card-header">
              <span class="slide-category-badge ${news.attachedNews.tagType}" style="font-size:0.7rem; padding:2px 8px;">
                ${news.attachedNews.tag}
              </span>
              <span class="news-card-source">${news.attachedNews.source}</span>
            </div>
            <div class="news-card-body">
              <h4 class="news-card-title">${news.attachedNews.title}</h4>
              <p class="news-card-summary">${news.attachedNews.summary}</p>
            </div>
          </div>
        `;
      }

      // 認証バッジの判定（ゴールドまたはブルー）
      let verifiedIconHtml = '';
      if (news.author.verifiedGold) {
        verifiedIconHtml = `
          <svg class="verified-icon gold" viewBox="0 0 24 24" title="認証済み組織・メディア">
            <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/>
          </svg>
        `;
      } else if (news.author.verified) {
        verifiedIconHtml = `
          <svg class="verified-icon" viewBox="0 0 24 24">
            <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/>
          </svg>
        `;
      }

      newsEl.innerHTML = `
        <div class="thread-left-col" style="margin-right: 12px;">
          <div class="avatar" style="background: ${news.author.avatarBg}; width: 40px; height: 40px; font-size: 1.15rem; border: 1px solid var(--border-color);">
            ${news.author.avatar}
          </div>
        </div>
        <div class="tweet-content-col">
          <div class="tweet-header">
            <div class="tweet-author-info">
              <span class="author-name">${news.author.name}</span>
              ${verifiedIconHtml}
              <span class="author-handle">${news.author.handle}</span>
              <span class="tweet-dot">·</span>
              <span class="tweet-time">${news.timestamp}</span>
            </div>
            <div style="display:flex; gap:10px; color:var(--text-secondary);">
              <svg style="width:16px;height:16px;fill:currentColor" viewBox="0 0 24 24"><path d="M12 7c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 7c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </div>
          </div>
          
          <div class="tweet-body">${this.formatTweetText(news.tweetText)}</div>
          
          ${cardHtml}
          
          <div class="tweet-action-bar">
            <button class="tweet-action-btn reply" title="返信">
              <svg viewBox="0 0 24 24"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.25c-4.42 0-8-3.58-8-8zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.32 2.688 6 6.005 6h2.25v2.42l5.05-2.8c1.97-1.09 3.19-3.17 3.19-5.42 0-3.39-2.75-6.2-6.13-6.2H9.756z"/></svg>
              <span>${news.stats.replies}</span>
            </button>
            <button class="tweet-action-btn rt" title="リポスト">
              <svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
              <span>${news.stats.retweets}</span>
            </button>
            <button class="tweet-action-btn like" title="いいね">
              <svg viewBox="0 0 24 24"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-2.428.12-4.5 2.12-4.5 4.86 0 2.22 1.325 4.38 3.567 6.64 1.92 1.93 4.223 3.65 4.67 3.98l.459.34.46-.34c.446-.33 2.749-2.05 4.669-3.98 2.242-2.26 3.567-4.42 3.567-6.64 0-2.74-2.072-4.74-4.5-4.86z"/></svg>
              <span>${news.stats.likes}</span>
            </button>
            <button class="tweet-action-btn view" title="表示件数">
              <svg viewBox="0 0 24 24"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>
              <span>${news.stats.views}</span>
            </button>
            <button class="tweet-action-btn bookmark" title="ブックマーク">
              <svg viewBox="0 0 24 24"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"/></svg>
            </button>
          </div>
        </div>
      `;

      // CloudflareエラーカードおよびCTAボタンのクリックイベント（スライド1への誘導）
      if (news.isCloudflare500Error) {
        const errorCard = newsEl.querySelector('#cfErrorHeroCard');
        const ctaBtn = newsEl.querySelector('#btnLeadToSlide');

        const goToSlide1 = () => {
          this.scrollToSlide(0);
          this.openModalForSlide(0);
        };

        if (errorCard) errorCard.addEventListener('click', goToSlide1);
        if (ctaBtn) ctaBtn.addEventListener('click', goToSlide1);
      }

      this.bindTweetActionEvents(newsEl);
      this.feedEl.appendChild(newsEl);
    });
  }

  renderToc() {
    this.tocListEl.innerHTML = '';
    this.slidesData.forEach((slide, idx) => {
      const item = document.createElement('button');
      item.className = `slide-toc-item ${idx === 0 ? 'active' : ''}`;
      item.dataset.index = idx;
      item.innerHTML = `
        <span class="toc-num">${idx + 1}</span>
        <span class="toc-text">${slide.topic}</span>
        <span class="toc-status-icon">${idx === 0 ? '●' : '○'}</span>
      `;
      item.addEventListener('click', () => {
        if (this.moreOptionsDropdown) this.moreOptionsDropdown.classList.remove('show');
        this.revealUpToIndex(idx);
        this.scrollToSlide(idx);
        this.openModalForSlide(idx);
      });
      this.tocListEl.appendChild(item);
    });
  }

  updateTocStatus() {
    const items = this.tocListEl.querySelectorAll('.slide-toc-item');
    items.forEach((item, idx) => {
      if (idx <= this.currentIndex) {
        item.classList.add('active');
        item.querySelector('.toc-status-icon').textContent = '●';
        item.querySelector('.toc-status-icon').style.color = '#1d9bf0';
      } else {
        item.classList.remove('active');
        item.querySelector('.toc-status-icon').textContent = '○';
        item.querySelector('.toc-status-icon').style.color = '#8b98a5';
      }
    });
  }

  updateProgress() {
    const total = this.slidesData.length;
    const current = Math.min(this.currentIndex + 1, total);
    const pct = Math.round((current / total) * 100);

    this.progressBarFill.style.width = `${pct}%`;
    if (this.slideProgressText) {
      this.slideProgressText.textContent = `${current} / ${total}`;
    }

    this.updateTocStatus();

    // 次の返信ボタンのラベル調整
    if (this.currentIndex >= total - 1) {
      this.replySectionEl.style.display = 'none';
      this.completedBanner.classList.add('active');
    } else {
      this.replySectionEl.style.display = 'flex';
      const nextSlideData = this.slidesData[this.currentIndex + 1];
      const placeholder = this.replyBoxEl.querySelector('.reply-placeholder');
      if (placeholder) {
        placeholder.textContent = `次のテーマ「${nextSlideData.topic}」を返信として投稿...`;
      }
    }
  }

  // タイムラインにツイート（スライドカード付き）をDOM追加
  appendTweet(index) {
    const data = this.slidesData[index];
    if (!data) return;

    const tweetEl = document.createElement('article');
    tweetEl.className = 'tweet-thread-item';
    tweetEl.id = `tweet-item-${index}`;
    tweetEl.dataset.index = index;

    // スライドカードのプレビューHTMLを生成
    const cardHtml = this.generateSlideCardHtml(data, index);

    tweetEl.innerHTML = `
      <div class="thread-left-col">
        <div class="avatar" style="background: ${index === 0 ? 'linear-gradient(135deg, #1d9bf0, #00ba7c)' : '#1d9bf0'}; font-weight: 700; font-size: 0.9rem; color: #fff;">
          ${index === 0 ? 'CF' : (index + 1)}
        </div>
        <div class="thread-connector-line"></div>
      </div>
      <div class="tweet-content-col">
        <div class="tweet-header">
          <div class="tweet-author-info">
            <span class="author-name">Cloudflare Incident Tech</span>
            <svg class="verified-icon" viewBox="0 0 24 24"><path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z"/></svg>
            <span class="author-handle">@cf_tech</span>
            <span class="tweet-dot">·</span>
            <span class="tweet-time">${data.timestamp}</span>
            <span class="tweet-topic-pill">${data.topic}</span>
          </div>
        </div>
        
        <div class="tweet-body">${this.formatTweetText(data.tweetText)}</div>
        
        <!-- Attached Slide Preview Card (Click to expand) -->
        <div class="slide-media-card" data-slide-index="${index}" title="クリックしてスライドを拡大表示">
          ${cardHtml}
        </div>
        
        <div class="tweet-action-bar">
          <button class="tweet-action-btn reply" title="返信">
            <svg viewBox="0 0 24 24"><path d="M1.751 10c0-4.42 3.584-8 8.005-8h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.25c-4.42 0-8-3.58-8-8zm8.005-6c-3.317 0-6.005 2.69-6.005 6 0 3.32 2.688 6 6.005 6h2.25v2.42l5.05-2.8c1.97-1.09 3.19-3.17 3.19-5.42 0-3.39-2.75-6.2-6.13-6.2H9.756z"/></svg>
            <span>${data.stats.replies}</span>
          </button>
          <button class="tweet-action-btn rt" title="リポスト">
            <svg viewBox="0 0 24 24"><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"/></svg>
            <span>${data.stats.retweets}</span>
          </button>
          <button class="tweet-action-btn like" title="いいね">
            <svg viewBox="0 0 24 24"><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-2.428.12-4.5 2.12-4.5 4.86 0 2.22 1.325 4.38 3.567 6.64 1.92 1.93 4.223 3.65 4.67 3.98l.459.34.46-.34c.446-.33 2.749-2.05 4.669-3.98 2.242-2.26 3.567-4.42 3.567-6.64 0-2.74-2.072-4.74-4.5-4.86z"/></svg>
            <span>${data.stats.likes}</span>
          </button>
          <button class="tweet-action-btn view" title="表示件数">
            <svg viewBox="0 0 24 24"><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10h2L6 21H4zm9.248 0v-7h2v7h-2z"/></svg>
            <span>${data.stats.views}</span>
          </button>
          <button class="tweet-action-btn share" title="共有">
            <svg viewBox="0 0 24 24"><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41L7.71 9.71 6.3 8.29 12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"/></svg>
          </button>
        </div>
      </div>
    `;

    // クリックで画像拡大モーダルを開くイベントを付加
    const cardEl = tweetEl.querySelector('.slide-media-card');
    cardEl.addEventListener('click', (e) => {
      this.openModalWithFlipAnimation(cardEl, index);
    });

    // いいね・RTのインタラクション
    this.bindTweetActionEvents(tweetEl);

    this.feedEl.appendChild(tweetEl);
  }

  // ハッシュタグやメンション、URL、太字の着色
  formatTweetText(text) {
    let formatted = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
      .replace(/#([\w\u3000-\u30fe\u4e00-\u9fa5]+)/g, '<span class="tweet-hashtag">#$1</span>')
      .replace(/@(\w+)/g, '<a href="#">@$1</a>');
    return formatted;
  }

  // スライドカードのプレビューHTML生成（16:9の画像風）
  generateSlideCardHtml(data, index) {
    const s = data.slide;
    let bodyHtml = '';

    if (s.metrics) {
      bodyHtml = `
        <div class="metrics-row">
          ${s.metrics.map(m => `
            <div class="metric-pill ${m.materialId ? 'has-material-interactive' : ''}" ${m.materialId ? `data-material-id="${m.materialId}" title="タップして「${m.label}」の詳細資料・解説を表示"` : ''}>
              <div class="metric-val" style="color: ${m.color}">${m.value}</div>
              <div class="metric-lbl">${m.label}</div>
              ${m.materialId ? `
                <span class="material-touch-hint">
                  <svg class="material-touch-hint-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  <span>資料解説</span>
                </span>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (s.statCards) {
      bodyHtml = `
        <div class="stats-grid-row">
          ${s.statCards.map(c => `
            <div class="stat-cell ${c.materialId ? 'has-material-interactive' : ''}" ${c.materialId ? `data-material-id="${c.materialId}" title="タップして資料・解説を表示"` : ''}>
              <div class="stat-num">${c.number}</div>
              <div class="stat-lbl">${c.label}</div>
              ${c.materialId ? `
                <span class="material-touch-hint">
                  <svg class="material-touch-hint-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  <span>資料解説</span>
                </span>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (s.statCards) {
      // Slide 3: 会社規模 - 20%ミニドーナツ + スタッツ
      bodyHtml = `
        <div style="display:flex; align-items:center; gap:14px; background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:10px 14px;">
          <div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">
            <svg viewBox="0 0 36 36" style="width:42px; height:42px; transform:rotate(-90deg);">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e1e8ed" stroke-width="3.8"/>
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#1d9bf0" stroke-width="3.8" stroke-dasharray="20 80" stroke-linecap="round"/>
            </svg>
            <div>
              <div style="font-weight:900; font-size:1.1rem; color:#1d9bf0; line-height:1;">約 20%</div>
              <div style="font-size:0.68rem; color:#536471; font-weight:700;">Webトラフィック</div>
            </div>
          </div>
          <div style="width:1px; height:32px; background:var(--border-color);"></div>
          <div style="display:flex; gap:12px; flex:1; justify-content:space-around;">
            <div>
              <div style="font-weight:800; font-size:0.95rem; color:#0f1419;">1.02億 /s</div>
              <div style="font-size:0.68rem; color:#536471;">処理リクエスト</div>
            </div>
            <div>
              <div style="font-weight:800; font-size:0.95rem; color:#0f1419;">335+ 都市</div>
              <div style="font-size:0.68rem; color:#536471;">125カ国PoP</div>
            </div>
          </div>
        </div>
      `;
    } else if (s.points) {
      // Slide 2: エグゼクティブサマリ - 4ステップ・インフォグラフィック
      bodyHtml = `
        <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; background:#f7f9fa; border:1px solid var(--border-color); border-radius:10px; padding:8px 10px;">
          <div style="text-align:center;">
            <div style="font-size:0.7rem; font-weight:800; color:#1d9bf0;">1. 発生</div>
            <div style="font-size:0.74rem; font-weight:700; color:#0f1419;">世界で5xx多発</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.7rem; font-weight:800; color:#ffad1f;">2. 原因</div>
            <div style="font-size:0.74rem; font-weight:700; color:#0f1419;">設定ファイル倍増</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.7rem; font-weight:800; color:#f4212e;">3. メカニズム</div>
            <div style="font-size:0.74rem; font-weight:700; color:#0f1419;">プロキシOOM停止</div>
          </div>
          <div style="text-align:center;">
            <div style="font-size:0.7rem; font-weight:800; color:#00ba7c;">4. 復旧</div>
            <div style="font-size:0.74rem; font-weight:700; color:#0f1419;">ロールバック完了</div>
          </div>
        </div>
      `;
    } else if (s.flowSteps) {
      // Slide 4: 処理経路 (Frontline) - GIFサムネイル + ミニパイプライン
      bodyHtml = `
        <div class="card-mini-split ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タップして詳細資料を表示"` : ''}>
          <img src="http_5xx_diagram.gif" alt="5xxエラーメカニズム" class="card-mini-thumb">
          <div class="card-mini-content">
            <div style="font-weight: 800; color: #0f1419; margin-bottom: 2px;">エッジプロキシ「Frontline」停止</div>
            <div style="font-size: 0.76rem; color: #536471;">全通信の玄関口がクラッシュし5xx多発</div>
            <div class="card-pipeline-steps">
              <span class="card-pipeline-step">ブラウザ</span>
              <span style="color:#8b98a5;">&rarr;</span>
              <span class="card-pipeline-step danger">Frontline 💥</span>
              <span style="color:#8b98a5;">&rarr;</span>
              <span class="card-pipeline-step">オリジン</span>
            </div>
          </div>
        </div>
      `;
    } else if (s.comparison) {
      // Slide 5: DB設定変更 (ClickHouse) - 正常 vs 異常 比較タグ
      bodyHtml = `
        <div class="db-compare-card ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タップしてClickHouse詳細資料を表示"` : ''} style="padding: 10px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight: 800; font-size: 0.85rem; color: #0f1419;">ClickHouse 権限変更の出力比較</span>
            <span style="font-size: 0.72rem; color: #f4212e; font-weight: 800;">行数倍増！</span>
          </div>
          <div class="card-compare-tags">
            <div class="card-compare-tag normal">
              <strong>通常:</strong> Unique 抽出 (約200行)
            </div>
            <div class="card-compare-tag bugged">
              <strong>変更後:</strong> 重複レコード (400行超)
            </div>
          </div>
        </div>
      `;
    } else if (s.boxes && s.themeType === 'vs-card') {
      // Slide 6: メモリ安全装置 (OOM保護) - ミニゲージ
      bodyHtml = `
        <div class="oom-gauge-container ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タップして設定肥大化資料を表示"` : ''} style="padding: 10px 14px; margin-bottom: 0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-weight: 800; font-size: 0.82rem; color: #0f1419;">コアプロキシ メモリ安全リミット</span>
            <span style="background: rgba(244,33,46,0.12); color:#f4212e; font-weight:800; font-size:0.7rem; padding: 2px 6px; border-radius:4px;">LIMIT HIT 💥</span>
          </div>
          <div class="oom-meter-track" style="height: 14px; margin: 8px 0 6px;">
            <div class="oom-meter-fill-normal" style="width: 35%;"></div>
            <div class="oom-meter-fill-overflow" style="left: 35%; width: 65%;"></div>
            <div class="oom-threshold-line" style="top: -4px; bottom: -4px;"></div>
          </div>
          <div class="oom-labels-row" style="font-size: 0.72rem;">
            <span style="color: #00ba7c;">通常 200行 (安全域)</span>
            <span style="color: #f4212e;">400行超 (プロセス強制終了)</span>
          </div>
        </div>
      `;
    } else if (s.events) {
      // Slide 7: タイムライン & 二次障害 - shiryou1.png サムネイル + ミニステップ
      bodyHtml = `
        <div class="card-mini-split ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タップしてタイムライン解説資料を表示"` : ''}>
          <img src="shiryou1.png" alt="Downdetector障害推移" class="card-mini-thumb">
          <div class="card-mini-content">
            <div style="font-weight: 800; color: #0f1419; margin-bottom: 2px;">Downdetector 1.1万件超スパイク (UTC)</div>
            <div class="timeline-mini-steps" style="margin-top: 4px;">
              ${s.events.slice(0, 3).map(ev => `
                <div class="timeline-mini-step ${ev.status}">
                  <span class="time-tag">${ev.time}</span>
                  <span>${ev.title}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (s.services) {
      // Slide 8: 主要Webサービス被害範囲 - 6社ロゴバー + DOWNバッジ
      bodyHtml = `
        <div class="card-services-bar ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タップして影響資料を表示"` : ''}>
          <div class="card-services-logos">
            ${s.services.map(srv => `
              <span class="service-logo-tile" style="width: 36px; height: 36px; border-radius: 8px;" title="${srv.name}">
                <img class="service-logo" style="width: 20px; height: 20px;" src="${srv.logo}" alt="${srv.name}">
              </span>
            `).join('')}
          </div>
          <div class="service-status-pulse">
            <span class="status-dot-blink"></span>
            <span>HTTP 502/503 DOWN</span>
          </div>
        </div>
      `;
    } else if (s.rows || s.themeType === 'impact-table') {
      // Slide 9: 内部被害 - 連鎖ドミノ倒しミニ図解
      bodyHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:10px 14px;">
          <div style="text-align:center;">
            <div style="font-size:1.1rem;">💥</div>
            <div style="font-weight:800; font-size:0.75rem; color:#f4212e;">Frontline</div>
            <div style="font-size:0.68rem; color:#536471;">プロキシ停止</div>
          </div>
          <div style="color:#f4212e; font-weight:800; font-size:1rem;">&rarr;</div>
          <div style="text-align:center;">
            <div style="font-size:1.1rem;">🔒</div>
            <div style="font-weight:800; font-size:0.75rem; color:#ffad1f;">Turnstile/KV</div>
            <div style="font-size:0.68rem; color:#536471;">認証/DB遮断</div>
          </div>
          <div style="color:#f4212e; font-weight:800; font-size:1rem;">&rarr;</div>
          <div style="text-align:center;">
            <div style="font-size:1.1rem;">❌</div>
            <div style="font-weight:800; font-size:0.75rem; color:#794bc4;">管理画面/Status</div>
            <div style="font-size:0.68rem; color:#536471;">共倒れ障害</div>
          </div>
        </div>
      `;
    } else if (s.steps || s.themeType === 'steps') {
      // Slide 10: 応急対策 - 3段階オペレーションミニ図解
      bodyHtml = `
        <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:8px; background:#ffffff; border:1.5px solid #00ba7c; border-radius:10px; padding:10px 12px;">
          <div>
            <span class="cmd-badge">STEP 1</span>
            <div style="font-weight:800; font-size:0.78rem; color:#0f1419; margin-top:2px;">🛑 配信停止</div>
          </div>
          <div>
            <span class="cmd-badge">STEP 2</span>
            <div style="font-weight:800; font-size:0.78rem; color:#0f1419; margin-top:2px;">📦 正常版Push</div>
          </div>
          <div>
            <span class="cmd-badge">STEP 3</span>
            <div style="font-weight:800; font-size:0.78rem; color:#0f1419; margin-top:2px;">🔄 プロキシ再起動</div>
          </div>
        </div>
      `;
    } else if (s.nodes || s.themeType === 'bypass-diagram') {
      // Slide 11: 内部迂回処置 - ルーティング分岐ミニ回路図
      bodyHtml = `
        <div style="background:#f7f9fa; border:1px solid var(--border-color); border-radius:10px; padding:10px 14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:0.74rem; font-weight:700; color:#536471;">トラフィック要求</span>
            <span style="font-size:0.74rem; font-weight:800; color:#00ba7c;">Workers KV / Access</span>
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(244,33,46,0.06); border:1px solid rgba(244,33,46,0.3); border-radius:6px; padding:3px 8px; font-size:0.72rem;">
              <span style="color:#f4212e; font-weight:800;">新Frontline (通常経路)</span>
              <span style="color:#f4212e; font-weight:800;">✖ 停止</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,186,124,0.08); border:1px solid #00ba7c; border-radius:6px; padding:3px 8px; font-size:0.72rem;">
              <span style="color:#00ba7c; font-weight:800;">旧プロキシ (迂回バイパス)</span>
              <span style="color:#00ba7c; font-weight:800;">✔ 稼働継続</span>
            </div>
          </div>
        </div>
      `;
    } else if (s.principles || s.themeType === 'policy') {
      // Slide 12: 恒久対策① - CI/CD 検問ゲートウェイミニ図解
      bodyHtml = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; background:#ffffff; border:1.5px solid #1d9bf0; border-radius:10px; padding:10px 12px;">
          <div style="font-size:0.72rem; font-weight:800; color:#536471;">DB生成</div>
          <span style="color:#1d9bf0;">&rarr;</span>
          <div style="background:rgba(29,155,240,0.08); border-radius:6px; padding:3px 6px; text-align:center;">
            <div style="font-size:0.72rem; font-weight:800; color:#1d9bf0;">🛡️ 3重検問</div>
            <div style="font-size:0.66rem; color:#536471;">サイズ・重複・ロード</div>
          </div>
          <span style="color:#1d9bf0;">&rarr;</span>
          <div style="font-size:0.72rem; font-weight:800; color:#00ba7c;">世界PoP配信</div>
        </div>
      `;
    } else if ((s.colLeft && s.colRight) || s.themeType === 'two-columns') {
      // Slide 13: 恒久対策② - キルスイッチ ＋ カナリア展開
      bodyHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:10px 12px;">
          <div style="border-left:3px solid #ffad1f; padding-left:8px;">
            <div style="font-weight:800; font-size:0.78rem; color:#0f1419;">🛑 キルスイッチ</div>
            <div style="font-size:0.68rem; color:#536471;">異常モジュールを数秒で即遮断</div>
          </div>
          <div style="border-left:3px solid #1d9bf0; padding-left:8px;">
            <div style="font-weight:800; font-size:0.78rem; color:#0f1419;">🎯 カナリアリリース</div>
            <div style="font-size:0.68rem; color:#536471;">少数PoP検証後に世界展開</div>
          </div>
        </div>
      `;
    } else if (s.lessons || s.themeType === 'lessons-grid') {
      // Slide 14: 総括と教訓 - 3大教訓「題名＋ミニ図」カード
      bodyHtml = `
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; background:#ffffff; border:1.5px solid #00ba7c; border-radius:10px; padding:10px 12px;">
          <div style="background:#f7f9fa; border-radius:6px; padding:6px 4px; text-align:center; border:1px solid #e1e8ed;">
            <div style="font-weight:900; color:#00ba7c; font-size:0.8rem;">教訓 01</div>
            <div style="font-size:0.68rem; font-weight:800; color:#0f1419; margin:2px 0;">内部ゼロトラスト</div>
            <div style="font-size:0.65rem; background:#fff; border-radius:4px; padding:2px; border:1px dashed #f59e0b; color:#b45309; font-weight:700;">🔍 検問ゲート</div>
          </div>
          <div style="background:#f7f9fa; border-radius:6px; padding:6px 4px; text-align:center; border:1px solid #e1e8ed;">
            <div style="font-weight:900; color:#00ba7c; font-size:0.8rem;">教訓 02</div>
            <div style="font-size:0.68rem; font-weight:800; color:#0f1419; margin:2px 0;">監視の完全独立</div>
            <div style="font-size:0.65rem; background:#fff; border-radius:4px; padding:2px; border:1px solid #00ba7c; color:#00ba7c; font-weight:700;">🛡️ 外部Status</div>
          </div>
          <div style="background:#f7f9fa; border-radius:6px; padding:6px 4px; text-align:center; border:1px solid #e1e8ed;">
            <div style="font-weight:900; color:#00ba7c; font-size:0.8rem;">教訓 03</div>
            <div style="font-size:0.68rem; font-weight:800; color:#0f1419; margin:2px 0;">キルスイッチ＆DR</div>
            <div style="font-size:0.65rem; background:#fff; border-radius:4px; padding:2px; border:1px solid #1d9bf0; color:#1d9bf0; font-weight:700;">⚡ 迂回バイパス</div>
          </div>
        </div>
      `;
    } else {
      bodyHtml = `
        <div style="background: rgba(29, 155, 240, 0.05); padding: 10px 14px; border-radius: 8px; border-left: 4px solid #1d9bf0; font-size: 0.85rem;" ${s.materialId ? `class="has-material-interactive" data-material-id="${s.materialId}" title="タップして詳細資料を表示"` : ''}>
          ${s.subtitle || 'クリックして詳細スライドを展開'}
        </div>
      `;
    }

    return `
      <div class="slide-inner-container">
        <div class="slide-badge-row">
          <span class="slide-category-badge ${s.badgeType}">${s.badge}</span>
          <div class="click-to-expand-hint">
            <svg style="width:14px;height:14px;fill:currentColor" viewBox="0 0 24 24"><path d="M15 3l2.3 2.3-2.89 2.87 1.42 1.42L18.7 6.7 21 9V3h-6zM3 9l2.3-2.3 2.87 2.89 1.42-1.42L6.7 5.3 9 3H3v6zm6 12l-2.3-2.3 2.89-2.87-1.42-1.42L5.3 17.3 3 15v6h6zm12-6l-2.3 2.3-2.87-2.89-1.42 1.42 2.89 2.87L15 21h6v-6z"/></svg>
            <span>拡大表示 (スライド ${index + 1}/${this.slidesData.length})</span>
          </div>
        </div>
        
        <div class="slide-content-area">
          <h3 class="slide-card-title">${s.title}</h3>
          <p class="slide-card-subtitle">${s.subtitle || ''}</p>
          ${bodyHtml}
        </div>
        
        <div class="slide-card-footer">
          <div style="display:flex; align-items:center; gap:6px;">
            <span>Cloudflare Incident</span>
            <span style="background: rgba(15, 20, 25, 0.06); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; color: #536471; font-weight: 700;">時刻: UTC表記</span>
          </div>
          ${s.materialId ? `<span class="has-material-interactive" data-material-id="${s.materialId}" style="color: #1d9bf0; font-weight: 700; text-decoration: underline;">技術解説資料を見る</span>` : `<span>Slide ${index + 1} of ${this.slidesData.length}</span>`}
        </div>
      </div>
    `;
  }

  bindTweetActionEvents(tweetEl) {
    const likeBtn = tweetEl.querySelector('.tweet-action-btn.like');
    if (likeBtn) {
      likeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        likeBtn.classList.toggle('liked');
        const countSpan = likeBtn.querySelector('span');
        let current = parseInt(countSpan.textContent.replace(/[^0-9]/g, '')) || 0;
        if (likeBtn.classList.contains('liked')) {
          countSpan.textContent = (current + 1).toLocaleString();
        } else {
          countSpan.textContent = Math.max(0, current - 1).toLocaleString();
        }
      });
    }

    const rtBtn = tweetEl.querySelector('.tweet-action-btn.rt');
    if (rtBtn) {
      rtBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rtBtn.style.color = '#00ba7c';
      });
    }
  }

  // 次のテーマのスライドへ「返信」としてポスト追加するアニメーション
  postNextSlideReply() {
    if (this.isPosting) return;
    if (this.currentIndex >= this.slidesData.length - 1) {
      return;
    }

    this.isPosting = true;
    this.postingLoader.classList.add('active');
    this.nextBtn.disabled = true;

    // Twitterのポスト送信アニメーション演出（350ms）
    setTimeout(() => {
      this.currentIndex++;
      this.appendTweet(this.currentIndex);
      this.updateProgress();

      this.postingLoader.classList.remove('active');
      this.nextBtn.disabled = false;
      this.isPosting = false;

      // 新しく追加されたツイートへスムーズスクロール
      const newTweet = document.getElementById(`tweet-item-${this.currentIndex}`);
      if (newTweet) {
        newTweet.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 380);
  }

  // 指定インデックスまで全てのスライドを展開
  revealUpToIndex(targetIndex) {
    while (this.currentIndex < targetIndex && this.currentIndex < this.slidesData.length - 1) {
      this.currentIndex++;
      this.appendTweet(this.currentIndex);
    }
    this.updateProgress();
  }

  expandAllSlides() {
    this.revealUpToIndex(this.slidesData.length - 1);
    const lastTweet = document.getElementById(`tweet-item-${this.currentIndex}`);
    if (lastTweet) {
      lastTweet.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  scrollToSlide(index) {
    const el = document.getElementById(`tweet-item-${index}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ==========================================================================
  // Twitter画像拡大FLIPアニメーション（モーダル拡大・縮小）
  // ==========================================================================
  openModalWithFlipAnimation(sourceCard, slideIndex) {
    this.activeSourceCard = sourceCard;
    this.modalIndex = slideIndex;

    // 拡大スライドの内容をレンダリング
    this.renderExpandedSlide(slideIndex);
    this.updateModalControls();

    // 1. ソース要素の画面内座標（First）を取得
    const rect = sourceCard.getBoundingClientRect();

    // 2. モーダルオーバーレイを表示可能状態にする
    this.modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // 3. モーダル内のカードの最終配置目標サイズ（Last）を計算
    // FLIPアニメーション: 最初はソースカードと同じ位置・サイズに見えるよう transform で調整
    const targetRect = this.modalSlideFrame.getBoundingClientRect();
    
    const deltaX = (rect.left + rect.width / 2) - (targetRect.left + targetRect.width / 2);
    const deltaY = (rect.top + rect.height / 2) - (targetRect.top + targetRect.height / 2);
    const scaleX = rect.width / targetRect.width;
    const scaleY = rect.height / targetRect.height;

    // 初回フレーム（Invert）
    this.modalSlideFrame.style.transition = 'none';
    this.modalSlideFrame.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
    this.modalSlideFrame.style.opacity = '0.9';

    // 次のフレームでスムーズにアニメーション（Play）
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.modalSlideFrame.style.transition = 'transform 0.4s cubic-bezier(0.19, 1, 0.22, 1), opacity 0.3s ease';
        this.modalSlideFrame.style.transform = 'translate(0px, 0px) scale(1, 1)';
        this.modalSlideFrame.style.opacity = '1';
      });
    });
  }

  closeModalWithFlipAnimation() {
    if (!this.modalOverlay.classList.contains('active')) return;

    // 現在のスライドに対応するTL上のカードを探す
    const currentCard = document.querySelector(`.slide-media-card[data-slide-index="${this.modalIndex}"]`);
    
    if (currentCard) {
      const rect = currentCard.getBoundingClientRect();
      const targetRect = this.modalSlideFrame.getBoundingClientRect();
      const deltaX = (rect.left + rect.width / 2) - (targetRect.left + targetRect.width / 2);
      const deltaY = (rect.top + rect.height / 2) - (targetRect.top + targetRect.height / 2);
      const scaleX = rect.width / targetRect.width;
      const scaleY = rect.height / targetRect.height;

      this.modalSlideFrame.style.transition = 'transform 0.32s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease';
      this.modalSlideFrame.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
      this.modalSlideFrame.style.opacity = '0';
    } else {
      this.modalSlideFrame.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
      this.modalSlideFrame.style.transform = 'scale(0.85)';
      this.modalSlideFrame.style.opacity = '0';
    }

    this.modalOverlay.style.opacity = '0';

    setTimeout(() => {
      this.modalOverlay.classList.remove('active');
      this.modalOverlay.style.opacity = '';
      this.modalSlideFrame.style.transform = '';
      this.modalSlideFrame.style.transition = '';
      document.body.style.overflow = '';
    }, 320);
  }

  openModalForSlide(index) {
    const card = document.querySelector(`.slide-media-card[data-slide-index="${index}"]`);
    if (card) {
      this.openModalWithFlipAnimation(card, index);
    } else {
      this.modalIndex = index;
      this.renderExpandedSlide(index);
      this.updateModalControls();
      this.modalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  // モーダル内の全画面スライドHTMLレンダリング（高解像度・詳細版）
  renderExpandedSlide(index) {
    const data = this.slidesData[index];
    if (!data) return;

    const s = data.slide;
    let visualHtml = '';

    if (s.themeType === 'hero') {
      visualHtml = `
        <div class="expanded-metrics-grid">
          ${s.metrics.map(m => `
            <div class="expanded-metric-card ${m.materialId ? 'has-material-interactive' : ''}" ${m.materialId ? `data-material-id="${m.materialId}" title="タッチして「${m.label}」の詳細資料・解説を表示"` : ''}>
              <div class="expanded-metric-val" style="color: ${m.color}">${m.value}</div>
              <div class="expanded-metric-lbl">${m.label}</div>
              ${m.materialId ? `
                <div class="material-touch-btn-badge">
                  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  <span>タッチして詳細資料・解説を表示</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (s.themeType === 'summary') {
      // Slide 2: エグゼクティブサマリ - 4ステップ・フロー図 ＋ ハイライト
      visualHtml = `
        <div class="summary-flow-grid">
          <div class="summary-flow-card accent">
            <span class="summary-flow-step">PHASE 1</span>
            <div class="summary-flow-title" style="color:#1d9bf0;">11:05 UTC 発生</div>
            <div class="summary-flow-desc">世界各地でHTTP 5xxエラーが急増し主要Webサービスが一斉ダウン</div>
          </div>
          <div class="summary-flow-card danger">
            <span class="summary-flow-step">PHASE 2</span>
            <div class="summary-flow-title" style="color:#ffad1f;">ClickHouse 権限</div>
            <div class="summary-flow-desc">Bot管理用設定ファイルが重複レコードにより想定の2倍以上へ肥大化</div>
          </div>
          <div class="summary-flow-card danger">
            <span class="summary-flow-step">PHASE 3</span>
            <div class="summary-flow-title" style="color:#f4212e;">Frontline OOM</div>
            <div class="summary-flow-desc">コアプロキシのメモリ安全装置が作動し世界中のプロセスが強制停止</div>
          </div>
          <div class="summary-flow-card success">
            <span class="summary-flow-step">PHASE 4</span>
            <div class="summary-flow-title" style="color:#00ba7c;">手動ロールバック</div>
            <div class="summary-flow-desc">配信停止と正常版への差し替えにより14:30 UTCに主要通信復旧</div>
          </div>
        </div>
        ${s.highlightBox ? `
          <div style="background: rgba(29, 155, 240, 0.08); border-left: 5px solid #1d9bf0; padding: 14px 18px; border-radius: 8px; margin-top: 14px;">
            <div style="font-weight: 800; color: #1d9bf0; margin-bottom: 2px; font-size: 0.95rem;">${s.highlightBox.title}</div>
            <div style="font-size: 0.95rem; color: #0f1419; font-weight: 600;">${s.highlightBox.text}</div>
          </div>
        ` : ''}
      `;
    } else if (s.themeType === 'stats') {
      // Slide 3: 会社規模 - 左: 20%ドーナツチャート / 右: 4つのスタッツカード
      visualHtml = `
        <div class="scale-visual-container">
          <div class="share-donut-card ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タッチして会社規模詳細資料を表示"` : ''}>
            <div style="font-weight: 800; font-size: 0.9rem; color: #536471; margin-bottom: 8px;">世界のWebトラフィックシェア</div>
            <div style="position: relative; width: 140px; height: 140px; display: flex; align-items: center; justify-content: center;">
              <svg class="share-donut-svg" viewBox="0 0 160 160">
                <circle class="share-donut-circle-bg" cx="80" cy="80" r="70"/>
                <circle class="share-donut-circle-val" cx="80" cy="80" r="70"/>
              </svg>
              <div class="donut-inner-text">
                <div class="donut-big-val">20%</div>
                <div class="donut-sub-lbl">Web全体の1/5</div>
              </div>
            </div>
            <div style="margin-top: 10px; font-size: 0.78rem; color: #536471; line-height: 1.4;">
              5サイトに1サイトがCloudflare経由で通信
            </div>
            ${s.materialId ? '<div class="material-touch-hint" style="margin-top:8px;">規模解説資料</div>' : ''}
          </div>
          <div class="expanded-metrics-grid" style="grid-template-columns: repeat(2, 1fr); margin: 0;">
            ${s.statCards.map(c => `
              <div class="expanded-metric-card ${c.materialId ? 'has-material-interactive' : ''}" ${c.materialId ? `data-material-id="${c.materialId}" title="タッチして資料・解説を表示"` : ''} style="padding: 16px;">
                <div class="expanded-metric-val" style="font-size: 1.8rem; color: #1d9bf0;">${c.number}</div>
                <div style="font-size: 0.8rem; font-weight: 800; color: #536471;">${c.unit}</div>
                <div class="expanded-metric-lbl" style="margin-top: 4px; font-size: 0.9rem;">${c.label}</div>
                <div style="font-size: 0.76rem; color: #8b98a5; margin-top: 2px;">${c.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (s.themeType === 'flowchart') {
      // Slide 4: 処理経路 (Frontline) - 左右分割 (左: GIFアニメーション / 右: パイプライン)
      visualHtml = `
        <div class="expanded-visual-split">
          <div class="split-media-panel danger-glow ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タップして詳細資料を表示"` : ''}>
            <div class="split-media-badge">
              <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              <span>アニメーション解説図</span>
            </div>
            <img src="http_5xx_diagram.gif" alt="HTTP 5xxエラー発生メカニズム" class="split-media-img">
            <div class="split-media-caption">
              <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:#1d9bf0;"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
              <span>図: リクエスト遮断と500/502/503エラー返却のメカニズム</span>
            </div>
          </div>
          <div class="split-content-panel">
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${s.flowSteps.map((st, i) => `
                <div class="${st.materialId ? 'has-material-interactive' : ''}" ${st.materialId ? `data-material-id="${st.materialId}" title="タッチしてFrontline詳細資料を表示"` : ''} style="background: ${st.isKey ? 'rgba(244, 33, 46, 0.08)' : '#ffffff'}; border: 2px solid ${st.isKey ? '#f4212e' : '#cfd9de'}; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; position: relative;">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <span style="font-weight: 800; font-size: 0.8rem; background: ${st.isKey ? '#f4212e' : '#536471'}; color: #fff; padding: 2px 8px; border-radius: 6px;">STEP ${st.step}</span>
                    <div>
                      <div style="font-weight: 800; font-size: 0.95rem; color: ${st.isKey ? '#f4212e' : '#0f1419'}">${st.title}</div>
                      <div style="font-size: 0.78rem; color: #536471;">${st.desc}</div>
                    </div>
                  </div>
                  ${st.isKey ? '<span style="background: #f4212e; color: #fff; font-size: 0.65rem; font-weight: 800; padding: 3px 8px; border-radius: 999px;">障害発生箇所 💥</span>' : ''}
                </div>
              `).join('')}
            </div>
            <div style="background: rgba(255, 173, 31, 0.12); padding: 10px 14px; border-radius: 8px; font-weight: 600; color: #9c6500; font-size: 0.88rem; border-left: 4px solid #ffad1f;">
              ${s.callout}
            </div>
          </div>
        </div>
      `;
    } else if (s.themeType === 'timeline-detail') {
      // Slide 5: DB設定変更 (ClickHouse) - スキーマ比較 + テーブル風図解
      visualHtml = `
        <div class="expanded-comparison-grid">
          <div class="db-compare-card">
            <div class="col-header">
              <h4 style="font-size: 1.1rem; font-weight: 800;">${s.comparison.before.title}</h4>
              <span class="col-header-badge green">${s.comparison.before.badge}</span>
            </div>
            <div class="db-table-preview">
              <div style="color: #00ba7c; font-weight: 700; margin-bottom: 4px;">-- SQL Query (Unique)</div>
              <div class="db-table-row"><span>feature_id_101</span><span>[Unique OK]</span></div>
              <div class="db-table-row"><span>feature_id_102</span><span>[Unique OK]</span></div>
              <div class="db-table-row" style="color: #00ba7c; font-weight: 700;"><span>Total Output:</span><span>~200 行 (正常)</span></div>
            </div>
            <ul style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; padding-left: 18px; margin-top: 12px;">
              ${s.comparison.before.items.map(it => `<li>${it}</li>`).join('')}
            </ul>
          </div>
          <div class="db-compare-card bugged ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タッチしてClickHouse詳細資料を表示"` : ''}>
            <div class="col-header">
              <h4 style="font-size: 1.1rem; font-weight: 800; color: #f4212e;">${s.comparison.after.title}</h4>
              <span class="col-header-badge red">${s.comparison.after.badge}</span>
            </div>
            <div class="db-table-preview">
              <div style="color: #f4212e; font-weight: 700; margin-bottom: 4px;">-- SQL Query (Duplicate)</div>
              <div class="db-table-row duplicate"><span>feature_id_101</span><span>[DUPLICATE !]</span></div>
              <div class="db-table-row duplicate"><span>feature_id_101</span><span>[DUPLICATE !]</span></div>
              <div class="db-table-row" style="color: #f4212e; font-weight: 800;"><span>Total Output:</span><span>400+ 行 (2倍肥大化)</span></div>
            </div>
            <ul style="display: flex; flex-direction: column; gap: 8px; font-size: 0.9rem; padding-left: 18px; color: #f4212e; margin-top: 12px;">
              ${s.comparison.after.items.map(it => `<li><strong>${it}</strong></li>`).join('')}
            </ul>
            ${s.materialId ? '<div class="material-touch-btn-badge" style="margin-top:12px;"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg><span>ClickHouse権限バグの詳細資料を表示</span></div>' : ''}
          </div>
        </div>
      `;
    } else if (s.themeType === 'vs-card') {
      // Slide 6: メモリ安全装置 (OOM保護) - プログレスバーゲージ + 2カラムボックス
      visualHtml = `
        <div class="oom-gauge-container">
          <div class="oom-gauge-header">
            <div class="oom-gauge-title">
              <svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:#f4212e;"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
              <span>コアプロキシ Frontline メモリ安全リミット（OOM保護メーター）</span>
            </div>
            <span style="background: rgba(244,33,46,0.12); color:#f4212e; font-weight:800; font-size:0.78rem; padding: 4px 10px; border-radius:999px;">SIGSEGV / PANIC 発動！</span>
          </div>
          <div class="oom-meter-track">
            <div class="oom-meter-fill-normal"></div>
            <div class="oom-threshold-line">
              <span class="oom-threshold-label">安全上限（約200行）</span>
            </div>
            <div class="oom-meter-fill-overflow"></div>
          </div>
          <div class="oom-labels-row">
            <span style="color: #00ba7c;">通常使用量: 35% (安定稼働)</span>
            <span style="color: #f4212e; font-weight: 800;">障害時: 200% 超過（メモリ保護が作動しプロセス強制停止）</span>
          </div>
        </div>

        <div class="expanded-comparison-grid">
          ${s.boxes.map(b => `
            <div class="${b.materialId ? 'has-material-interactive' : ''}" ${b.materialId ? `data-material-id="${b.materialId}" title="タッチして設定肥大化メカニズム資料を表示"` : ''} style="background: #ffffff; border: 2px solid #cfd9de; border-radius: 16px; padding: 18px 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h4 style="font-size: 1.15rem; font-weight: 800;">${b.title}</h4>
                <span style="background: rgba(244, 33, 46, 0.12); color: #f4212e; font-weight: 800; font-size: 0.76rem; padding: 3px 8px; border-radius: 999px;">${b.status}</span>
              </div>
              <p style="font-size: 0.95rem; line-height: 1.5; color: #536471;">${b.desc}</p>
              ${b.materialId ? '<div class="material-touch-hint" style="margin-top:8px;">資料解説</div>' : ''}
            </div>
          `).join('')}
        </div>
        <div style="margin-top: 14px; font-size: 0.92rem; font-weight: 700; color: #536471; text-align: center;">
          ${s.footerSummary}
        </div>
      `;
    } else if (s.themeType === 'timeline-horizontal') {
      // Slide 7: タイムライン & 二次障害 - 左右分割 (左: shiryou1.png / 右: フラッピングとステップ)
      visualHtml = `
        <div class="expanded-visual-split">
          <div class="split-media-panel ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タッチして障害推移資料を表示"` : ''}>
            <div class="split-media-badge">
              <svg viewBox="0 0 24 24" style="width:12px;height:12px;fill:currentColor;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/></svg>
              <span>実測推移グラフ（資料1）</span>
            </div>
            <img src="shiryou1.png" alt="Downdetector障害推移" class="split-media-img">
            <div class="split-media-caption">
              <span>Downdetector報告数: 最大11,230件のピークと復旧推移</span>
            </div>
          </div>
          <div class="split-content-panel">
            <div style="background: rgba(255, 173, 31, 0.1); border-left: 4px solid #ffad1f; padding: 10px 14px; border-radius: 8px;">
              <div style="font-weight: 800; font-size: 0.9rem; color: #9c6500; margin-bottom: 2px;">5分周期の「フラッピング現象」</div>
              <div style="font-size: 0.78rem; color: #536471;">設定ファイルが5分毎に自動生成され、正常（回復）と異常（ダウン）が交互に切り替わり初動を混乱させた。</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${s.events.map(ev => `
                <div class="expanded-timeline-node ${ev.status} ${ev.materialId ? 'has-material-interactive' : ''}" ${ev.materialId ? `data-material-id="${ev.materialId}" title="タッチしてタイムライン解説資料を表示"` : ''} style="display: flex; align-items: center; justify-content: space-between; padding: 8px 12px;">
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="node-time" style="margin: 0; font-size: 0.78rem;">${ev.time}</span>
                    <span class="node-title" style="margin: 0; font-size: 0.9rem;">${ev.title}</span>
                  </div>
                  <span style="font-size: 0.75rem; color: #536471;">${ev.desc}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    } else if (s.themeType === 'grid-services') {
      // Slide 8: 主要Webサービス被害範囲 - サービス死活監視モニター風グリッド
      visualHtml = `
        <div class="service-monitor-grid">
          ${s.services.map(srv => `
            <div class="service-monitor-card">
              <div class="service-monitor-header">
                <span class="service-logo-tile"><img class="service-logo" src="${srv.logo}" alt="${srv.name}"></span>
                <div class="service-status-pulse">
                  <span class="status-dot-blink"></span>
                  <span>HTTP 502/503 DOWN</span>
                </div>
              </div>
              <div>
                <div class="service-name" style="font-size: 1.1rem; margin-bottom: 4px;">${srv.name}</div>
                <div class="service-desc" style="font-size: 0.85rem; line-height: 1.4;">${srv.impact}</div>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    } else if (s.themeType === 'impact-table') {
      // Slide 9: 内部被害 - 連鎖ドミノ倒し相関図
      visualHtml = `
        <div class="cascade-diagram-grid ${s.materialId ? 'has-material-interactive' : ''}" ${s.materialId ? `data-material-id="${s.materialId}" title="タッチして内部サービス影響資料を表示"` : ''}>
          <div class="cascade-step-box danger-root">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; color:#f4212e; font-size:0.8rem;">第1波：トリガー</span>
              <span style="font-size:1.2rem;">💥</span>
            </div>
            <h4 style="font-size:1.1rem; font-weight:800; color:#f4212e;">コアプロキシ Frontline</h4>
            <div style="font-size:0.82rem; color:#536471; line-height:1.4;">
              肥大化した設定ファイルのロードでメモリ安全装置が作動しプロセス強制停止。
            </div>
            <div style="font-size:0.75rem; background:rgba(244,33,46,0.1); color:#f4212e; font-weight:700; padding:4px 8px; border-radius:4px; margin-top:4px;">
              影響: HTTP 500 / 502 急増
            </div>
          </div>

          <div class="cascade-connector-arrow">
            <span>&rarr;</span>
            <span class="cascade-connector-label">連鎖遮断</span>
          </div>

          <div class="cascade-step-box warning-mid">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; color:#ffad1f; font-size:0.8rem;">第2波：基幹機能</span>
              <span style="font-size:1.2rem;">🔒</span>
            </div>
            <h4 style="font-size:1.1rem; font-weight:800; color:#0f1419;">Turnstile & Workers KV</h4>
            <div style="font-size:0.82rem; color:#536471; line-height:1.4;">
              フロントエンドゲートウェイ要求が5xxとなり、認証（CAPTCHA）と分散ストレージが全面停止。
            </div>
            <div style="font-size:0.75rem; background:rgba(255,173,31,0.1); color:#9c6500; font-weight:700; padding:4px 8px; border-radius:4px; margin-top:4px;">
              影響: 外部サイトでログイン不可
            </div>
          </div>

          <div class="cascade-connector-arrow">
            <span>&rarr;</span>
            <span class="cascade-connector-label">共倒れ</span>
          </div>

          <div class="cascade-step-box lockout-end">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <span style="font-weight:900; color:#794bc4; font-size:0.8rem;">第3波：運用不能</span>
              <span style="font-size:1.2rem;">❌</span>
            </div>
            <h4 style="font-size:1.1rem; font-weight:800; color:#794bc4;">管理画面 & ステータス</h4>
            <div style="font-size:0.82rem; color:#536471; line-height:1.4;">
              認証障害とアクセス集中により管理者自身もログイン不能に。ステータスページもダウン。
            </div>
            <div style="font-size:0.75rem; background:rgba(121,75,196,0.1); color:#794bc4; font-weight:700; padding:4px 8px; border-radius:4px; margin-top:4px;">
              影響: 初動確認・広報が難航
            </div>
          </div>
        </div>
        ${s.materialId ? '<div class="material-touch-btn-badge" style="margin-top:14px;"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg><span>内部サービス影響の詳細資料を表示</span></div>' : ''}
      `;
    } else if (s.themeType === 'steps') {
      // Slide 10: 応急対策 - 3段階オペレーションコマンド図
      visualHtml = `
        <div class="emergency-cmd-grid">
          ${s.steps.map(step => `
            <div class="emergency-cmd-card ${step.materialId ? 'has-material-interactive' : ''}" ${step.materialId ? `data-material-id="${step.materialId}" title="タッチして緊急ロールバック手順資料を表示"` : ''}>
              <span class="cmd-badge">${step.num}</span>
              <h4 style="font-size:1.1rem; font-weight:800; color:#0f1419;">${step.title}</h4>
              <div class="cmd-action-box">
                <span style="color:#00ba7c;">$</span>
                <span>${step.num === 'STEP 1' ? 'kill pipeline_job; stop_propagation' : step.num === 'STEP 2' ? 'deploy --force safe_200lines' : 'systemctl restart frontline --gradual'}</span>
              </div>
              <p style="font-size:0.88rem; color:#536471; line-height:1.5;">${step.desc}</p>
              ${step.materialId ? '<div class="material-touch-hint" style="margin-top:auto;">手順資料解説</div>' : ''}
            </div>
          `).join('')}
        </div>
      `;
    } else if (s.themeType === 'bypass-diagram') {
      // Slide 11: 内部迂回処置 - ルーティング分岐回路図
      visualHtml = `
        <div class="bypass-circuit-wrapper">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:800; font-size:1.05rem; color:#0f1419;">基幹サービス向け 緊急迂回フェイルオーバー回路</div>
            <span style="font-size:0.75rem; background:rgba(0,186,124,0.12); color:#00ba7c; font-weight:800; padding:3px 10px; border-radius:999px;">セッション全滅を回避</span>
          </div>

          <div class="bypass-routes-container">
            <div class="bypass-route-row failed">
              <div class="route-status-icon failed">✖</div>
              <div style="flex:1;">
                <div style="font-weight:800; font-size:0.95rem; color:#f4212e;">新プロキシ Frontline（通常経路）</div>
                <div style="font-size:0.8rem; color:#536471;">肥大化した設定ファイルのロードによりメモリ安全装置で停止中</div>
              </div>
              <span style="font-size:0.75rem; font-weight:800; color:#f4212e; background:#ffffff; padding:4px 8px; border-radius:6px; border:1px solid #f4212e;">通信遮断</span>
            </div>

            <div class="bypass-route-row active">
              <div class="route-status-icon active">✔</div>
              <div style="flex:1;">
                <div style="font-weight:800; font-size:0.95rem; color:#00ba7c;">旧プロキシ（緊急迂回バイパスルート）</div>
                <div style="font-size:0.8rem; color:#536471;">安定版の旧世代プロキシへトラフィックを即座にリルート</div>
              </div>
              <span style="font-size:0.75rem; font-weight:800; color:#00ba7c; background:#ffffff; padding:4px 8px; border-radius:6px; border:1px solid #00ba7c;">Workers KV / Access 救済</span>
            </div>
          </div>

          <div style="margin-top:14px; background:rgba(29,155,240,0.06); border-left:4px solid #1d9bf0; padding:10px 14px; border-radius:6px; font-size:0.88rem; color:#0f1419; font-weight:600;">
            ${s.lesson}
          </div>
        </div>
      `;
    } else if (s.themeType === 'policy') {
      // Slide 12: 恒久対策① - CI/CD ゲートキーパー検問所図解
      visualHtml = `
        <div class="gatekeeper-flow">
          <div class="gate-node" style="border-color:#536471;">
            <div style="font-size:1.5rem;">🗄️</div>
            <div style="font-weight:800; font-size:0.88rem;">ClickHouse</div>
            <span class="gate-badge-pill" style="color:#536471; background:#f0f3f4;">自動生成</span>
          </div>

          <div style="color:#1d9bf0; font-size:1.2rem; font-weight:800;">&rarr;</div>

          <div class="gate-node shield">
            <div style="font-size:1.5rem;">🛡️</div>
            <div style="font-weight:800; font-size:0.88rem;">検問 01</div>
            <div style="font-size:0.75rem; color:#536471;">行数＆サイズ上限</div>
            <span class="gate-badge-pill">上限約200行</span>
          </div>

          <div style="color:#1d9bf0; font-size:1.2rem; font-weight:800;">&rarr;</div>

          <div class="gate-node shield">
            <div style="font-size:1.5rem;">🛡️</div>
            <div style="font-weight:800; font-size:0.88rem;">検問 02</div>
            <div style="font-size:0.75rem; color:#536471;">重複レコード排除</div>
            <span class="gate-badge-pill">二重検証</span>
          </div>

          <div style="color:#1d9bf0; font-size:1.2rem; font-weight:800;">&rarr;</div>

          <div class="gate-node shield">
            <div style="font-size:1.5rem;">🛡️</div>
            <div style="font-weight:800; font-size:0.88rem;">検問 03</div>
            <div style="font-size:0.75rem; color:#536471;">ダミーロード試験</div>
            <span class="gate-badge-pill">OOM事前検査</span>
          </div>

          <div style="color:#1d9bf0; font-size:1.2rem; font-weight:800;">&rarr;</div>

          <div class="gate-node endpoint">
            <div style="font-size:1.5rem;">🌐</div>
            <div style="font-weight:800; font-size:0.88rem; color:#00ba7c;">世界配信</div>
            <span class="gate-badge-pill" style="color:#00ba7c; background:rgba(0,186,124,0.1);">335都市PoP</span>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-top:16px;">
          ${s.principles.map((pr, i) => `
            <div style="background:#ffffff; border:1px solid var(--border-color); border-radius:10px; padding:12px; box-shadow:var(--shadow-sm);">
              <h4 style="font-size:0.95rem; font-weight:800; color:#1d9bf0; margin-bottom:4px;">0${i+1}. ${pr.title}</h4>
              <p style="font-size:0.82rem; color:#536471; line-height:1.4;">${pr.desc}</p>
            </div>
          `).join('')}
        </div>
      `;
    } else if (s.themeType === 'two-columns') {
      // Slide 13: 恒久対策② - キルスイッチ ＋ カナリア展開
      visualHtml = `
        <div class="defense-tactic-split">
          <div class="tactic-column-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h4 style="font-size:1.15rem; font-weight:800; color:#0f1419;">${s.colLeft.title}</h4>
              <span style="font-size:0.75rem; font-weight:800; color:#ffad1f; background:rgba(255,173,31,0.12); padding:3px 8px; border-radius:999px;">${s.colLeft.tag}</span>
            </div>
            <div class="tactic-diagram-box">
              <span style="font-size:0.8rem; font-weight:700;">本体プロキシ (Frontline)</span>
              <span style="color:#ffad1f; font-weight:900;">⚡ 切離し ⚡</span>
              <span style="font-size:0.8rem; font-weight:700; color:#f4212e;">異常Botモジュール</span>
            </div>
            <ul style="display:flex; flex-direction:column; gap:8px; font-size:0.9rem; padding-left:18px; color:#536471;">
              ${s.colLeft.bullets.map(b => `<li>${b}</li>`).join('')}
            </ul>
          </div>

          <div class="tactic-column-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h4 style="font-size:1.15rem; font-weight:800; color:#0f1419;">${s.colRight.title}</h4>
              <span style="font-size:0.75rem; font-weight:800; color:#1d9bf0; background:rgba(29,155,240,0.12); padding:3px 8px; border-radius:999px;">${s.colRight.tag}</span>
            </div>
            <div class="tactic-diagram-box">
              <span style="font-size:0.75rem; font-weight:700;">1〜2 PoP (カナリア)</span>
              <span style="color:#1d9bf0;">&rarr;</span>
              <span style="font-size:0.75rem; font-weight:700;">10% 展開</span>
              <span style="color:#1d9bf0;">&rarr;</span>
              <span style="font-size:0.75rem; font-weight:700; color:#00ba7c;">全335都市</span>
            </div>
            <ul style="display:flex; flex-direction:column; gap:8px; font-size:0.9rem; padding-left:18px; color:#536471;">
              ${s.colRight.bullets.map(b => `<li>${b}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } else if (s.themeType === 'lessons-grid') {
      // Slide 14: 総括と教訓 - 3大教訓「題名＋図」アーキテクチャ図解カード
      visualHtml = `
        <div class="lessons-infographic-grid">
          ${s.lessons.map(ls => `
            <div class="lesson-infographic-card ${ls.materialId ? 'has-material-interactive' : ''}" ${ls.materialId ? `data-material-id="${ls.materialId}" title="タッチして「${ls.title}」詳細図解資料を表示"` : ''}>
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:1.5rem; font-weight:900; color:#00ba7c;">${ls.num}</span>
                <span style="font-size:1.1rem;">${ls.num === '01' ? '🔍' : ls.num === '02' ? '🛡️' : '⚡'}</span>
              </div>
              <h4 style="font-size:0.98rem; font-weight:800; color:#0f1419; margin-bottom:0;">${ls.title}</h4>
              
              <!-- 題名の直下に配置する図解（ビジュアル回路・ダイアグラム） -->
              <div class="lesson-diagram-mini" style="flex-direction:column; gap:4px; padding:10px 8px;">
                ${ls.num === '01' ? `
                  <div style="font-size:0.72rem; color:#536471; font-weight:700;">【CI/CD 検問ゲート】</div>
                  <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:0.75rem; width:100%;">
                    <span style="background:#fff; border:1px solid #cfd9de; border-radius:4px; padding:2px 6px;">クエリ400行</span>
                    <span style="color:#f59e0b; font-weight:900;">➔ ⛔</span>
                    <span style="background:#e8f5e9; border:1px solid #00ba7c; border-radius:4px; padding:2px 6px; color:#00ba7c; font-weight:800;">335都市保護</span>
                  </div>
                ` : ls.num === '02' ? `
                  <div style="font-size:0.72rem; color:#536471; font-weight:700;">【共倒れ防止・外部Status】</div>
                  <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:0.75rem; width:100%;">
                    <span style="background:#fff5f5; border:1px solid #f4212e; border-radius:4px; padding:2px 6px; color:#f4212e;">自社 500💥</span>
                    <span style="color:#536471;">vs</span>
                    <span style="background:#e8f5e9; border:1.5px solid #00ba7c; border-radius:4px; padding:2px 6px; color:#00ba7c; font-weight:800;" class="pulse-green">外部Status 100% 🟢</span>
                  </div>
                ` : `
                  <div style="font-size:0.72rem; color:#536471; font-weight:700;">【バイパス回路 ＆ マルチCDN】</div>
                  <div style="display:flex; align-items:center; justify-content:center; gap:6px; font-size:0.75rem; width:100%;">
                    <span style="background:#fff; border:1px solid #cfd9de; border-radius:4px; padding:2px 6px;">Bot異常 ⚡</span>
                    <span style="color:#00ba7c; font-weight:900;">➔ [迂回] ➔</span>
                    <span style="background:#e8f5e9; border:1px solid #00ba7c; border-radius:4px; padding:2px 6px; color:#00ba7c; font-weight:800;">通信継続 🚀</span>
                  </div>
                `}
              </div>

              ${ls.materialId ? `
                <div class="material-touch-hint" style="margin-top:auto; font-size:0.75rem; padding:4px 8px; background:#eff3f4; border-radius:6px; text-align:center; color:#1d9bf0; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;">
                  <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                  <span>詳細図解・グラフ資料を表示</span>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        <div style="text-align: center; font-weight: 700; color: #1d9bf0; font-size: 0.95rem; margin-top: 14px;">
          ${s.finalThank}
        </div>
      `;
    }

    this.modalSlideFrame.innerHTML = `
      <div class="expanded-slide-wrapper">
        <div class="expanded-top-header">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="expanded-topic-badge slide-category-badge ${s.badgeType}">${s.badge}</span>
            ${s.materialId ? `
              <button class="widget-btn has-material-interactive" data-material-id="${s.materialId}" style="width:auto; padding: 4px 12px; font-size: 0.78rem; border-color: #1d9bf0; color: #1d9bf0; display:flex; align-items:center; gap:4px;">
                <svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                <span>関連資料・技術解説</span>
              </button>
            ` : ''}
          </div>
          <span class="expanded-theme-watermark">2025 Cloudflare Incident Analysis</span>
        </div>
        
        <h2 class="expanded-title">${s.title}</h2>
        <p class="expanded-subtitle">${s.subtitle || ''}</p>
        
        <div class="expanded-body-area">
          ${visualHtml}
        </div>
        
        <div class="expanded-footer-bar">
          <div style="display:flex; align-items:center; gap:10px;">
            <span>Cloudflare Post-Mortem Slide Deck</span>
            <span style="background: rgba(15, 20, 25, 0.06); padding: 2px 8px; border-radius: 4px; font-size: 0.74rem; color: #536471; font-weight: 700;">※ 記載時刻はすべて世界協定時（UTC）表記です（日本時間 JST = UTC+9）</span>
          </div>
          <span>Slide ${index + 1} of ${this.slidesData.length}</span>
        </div>
      </div>
    `;
  }

  updateModalControls() {
    this.modalCounter.textContent = `${this.modalIndex + 1} / ${this.slidesData.length}`;
    this.modalPrevBtn.disabled = (this.modalIndex <= 0);
    this.modalNextBtn.disabled = (this.modalIndex >= this.slidesData.length - 1);
  }

  modalNext() {
    if (this.modalIndex < this.slidesData.length - 1) {
      this.modalIndex++;
      // もしタイムライン側でまだ表示されていないスライドなら自動展開
      if (this.modalIndex > this.currentIndex) {
        this.revealUpToIndex(this.modalIndex);
      }
      this.renderExpandedSlide(this.modalIndex);
      this.updateModalControls();
      this.scrollToSlide(this.modalIndex);
    }
  }

  modalPrev() {
    if (this.modalIndex > 0) {
      this.modalIndex--;
      this.renderExpandedSlide(this.modalIndex);
      this.updateModalControls();
      this.scrollToSlide(this.modalIndex);
    }
  }

  // ==========================================================================
  // Slide Material Detail Modal (詳細解説・資料モーダル制御)
  // ==========================================================================
  openMaterialModal(materialId) {
    const materials = (typeof window !== 'undefined' && window.SlideMaterials)
      ? window.SlideMaterials
      : (window.SlideParser && window.SlideParser.SlideMaterials ? window.SlideParser.SlideMaterials : {});
    
    const m = materials[materialId];
    if (!m) return;

    // Badge
    if (this.matModalBadge) {
      this.matModalBadge.className = `slide-category-badge ${m.badgeType || 'primary'}`;
      this.matModalBadge.textContent = m.badge || '技術解説資料';
    }

    // Title & Subtitle
    if (this.matModalTitle) this.matModalTitle.textContent = m.title;
    if (this.matModalSubhead) this.matModalSubhead.textContent = m.subtitle || '';

    // Body content assembly
    let bodyHtml = '';

    // Image (e.g. shiryou1.png Downdetector outage report)
    if (m.image) {
      bodyHtml += `
        <div class="material-img-container">
          <img src="${m.image}" alt="${m.imageCaption || m.title}" class="material-img">
          ${m.imageCaption ? `
            <div class="material-img-caption">
              <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z"/></svg>
              <span>${m.imageCaption}</span>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Sections
    if (m.sections && Array.isArray(m.sections)) {
      m.sections.forEach(sec => {
        bodyHtml += `
          <div class="material-section-block">
            <h4 class="material-section-heading">
              <svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:#1d9bf0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
              <span>${sec.heading}</span>
            </h4>
            ${sec.diagramHtml ? `
              <div class="material-diagram-wrapper">
                ${sec.diagramHtml}
              </div>
            ` : ''}
            ${sec.text ? `<p class="material-section-text">${sec.text}</p>` : ''}
            ${sec.cards ? `
              <div class="material-cards-grid">
                ${sec.cards.map(c => `
                  <div class="material-card-item" style="border-left: 4px solid ${c.color || '#1d9bf0'};">
                    <div class="material-card-item-title" style="color: ${c.color || '#0f1419'}">${c.title}</div>
                    <p class="material-card-item-desc">${c.desc}</p>
                  </div>
                `).join('')}
              </div>
            ` : ''}
            ${sec.tags ? `
              <div class="material-tags-row">
                ${sec.tags.map(t => `<span class="material-tag-pill">${t}</span>`).join('')}
              </div>
            ` : ''}
            ${sec.logos ? `
              <div class="material-logos-grid">
                ${sec.logos.map(l => `
                  <div class="material-logo-item">
                    <span class="service-logo-tile"><img class="service-logo" src="${l.logo}" alt="${l.name}"></span>
                    <span class="material-logo-name">${l.name}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    // Key Points
    if (m.keyPoints && Array.isArray(m.keyPoints)) {
      bodyHtml += `
        <div class="material-keypoints-box">
          <div class="material-keypoints-title">
            <svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:currentColor;"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            <span>重要サマリ & 技術ポイント</span>
          </div>
          ${m.keyPoints.map(kp => `
            <div class="material-keypoint-row">
              <span class="material-keypoint-label">${kp.label}</span>
              <span class="material-keypoint-val">${kp.val}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (this.matModalBody) {
      this.matModalBody.innerHTML = bodyHtml;
      this.matModalBody.scrollTop = 0;
    }

    if (this.materialModalOverlay) {
      this.materialModalOverlay.classList.add('active');
      this.materialModalOverlay.setAttribute('aria-hidden', 'false');
    }

    // Ensure scroll position is reset to top so shiryou1.png image is immediately in view
    requestAnimationFrame(() => {
      if (this.matModalBody) this.matModalBody.scrollTop = 0;
    });
    setTimeout(() => {
      if (this.matModalBody) this.matModalBody.scrollTop = 0;
    }, 40);
  }

  closeMaterialModal() {
    if (this.materialModalOverlay) {
      this.materialModalOverlay.classList.remove('active');
      this.materialModalOverlay.setAttribute('aria-hidden', 'true');
    }
  }

  bindEvents() {
    // スライド資料モーダル (Material Modal) 閉じる操作
    if (this.btnCloseMatModal) {
      this.btnCloseMatModal.addEventListener('click', () => this.closeMaterialModal());
    }
    if (this.btnConfirmCloseMatModal) {
      this.btnConfirmCloseMatModal.addEventListener('click', () => this.closeMaterialModal());
    }
    if (this.materialModalOverlay) {
      this.materialModalOverlay.addEventListener('click', (e) => {
        if (e.target === this.materialModalOverlay) {
          this.closeMaterialModal();
        }
      });
    }

    // 資料項目クリック・タッチの全体委譲
    document.addEventListener('click', (e) => {
      const matTrigger = e.target.closest('[data-material-id]');
      if (matTrigger) {
        e.stopPropagation();
        e.preventDefault();
        const matId = matTrigger.getAttribute('data-material-id');
        if (matId) {
          this.openMaterialModal(matId);
        }
      }
    });

    // 返信欄の「次のスライドを返信」
    this.nextBtn.addEventListener('click', () => this.postNextSlideReply());
    this.replyBoxEl.addEventListener('click', (e) => {
      if (e.target !== this.nextBtn && !this.nextBtn.contains(e.target)) {
        this.postNextSlideReply();
      }
    });

    // サイドバーの「ポストする」（次のスライド返信）
    if (this.navPostBtn) {
      this.navPostBtn.addEventListener('click', () => this.postNextSlideReply());
    }

    // ホーム（タイムライン先頭へスムーズスクロール）
    const goHome = (e) => {
      if (e) e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
      if (this.navHomeBtn) this.navHomeBtn.classList.add('active');
    };
    if (this.navHomeBtn) {
      this.navHomeBtn.addEventListener('click', goHome);
    }
    if (this.twitterLogoBtn) {
      this.twitterLogoBtn.addEventListener('click', goHome);
    }

    // 話題を検索（トレンド/速報ツイートへスクロール）
    if (this.navExploreBtn) {
      this.navExploreBtn.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        this.navExploreBtn.classList.add('active');
        const newsCard = document.getElementById('news-main');
        if (newsCard) {
          newsCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }

    // すべて展開
    if (this.btnExpandAll) {
      this.btnExpandAll.addEventListener('click', () => {
        if (this.moreOptionsDropdown) this.moreOptionsDropdown.classList.remove('show');
        this.expandAllSlides();
      });
    }

    // 最初からやり直し
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => {
        if (this.moreOptionsDropdown) this.moreOptionsDropdown.classList.remove('show');
        this.resetTimeline();
      });
    }

    // スライド（全画面表示モード）
    if (this.btnPresentMode) {
      this.btnPresentMode.addEventListener('click', () => {
        this.openModalForSlide(this.modalIndex || 0);
      });
    }

    // もっと見る ドロップダウンメニュー
    if (this.btnMoreOptions && this.moreOptionsDropdown) {
      this.btnMoreOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moreOptionsDropdown.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!this.moreOptionsDropdown.contains(e.target) && !this.btnMoreOptions.contains(e.target)) {
          this.moreOptionsDropdown.classList.remove('show');
        }
      });
    }

    if (this.dropResetTl) {
      this.dropResetTl.addEventListener('click', () => {
        if (this.moreOptionsDropdown) this.moreOptionsDropdown.classList.remove('show');
        this.resetTimeline();
      });
    }

    if (this.dropExpandAll) {
      this.dropExpandAll.addEventListener('click', () => {
        if (this.moreOptionsDropdown) this.moreOptionsDropdown.classList.remove('show');
        this.expandAllSlides();
      });
    }

    if (this.dropReloadMd) {
      this.dropReloadMd.addEventListener('click', () => {
        if (this.moreOptionsDropdown) this.moreOptionsDropdown.classList.remove('show');
        this.mdTextarea.value = getDefaultMd();
        this.mdModalOverlay.classList.add('active');
      });
    }

    // モーダル操作
    this.modalCloseBtn.addEventListener('click', () => this.closeModalWithFlipAnimation());
    this.modalPrevBtn.addEventListener('click', () => this.modalPrev());
    this.modalNextBtn.addEventListener('click', () => this.modalNext());

    this.modalOverlay.addEventListener('click', (e) => {
      // 背景クリックで閉じる
      if (e.target === this.modalOverlay) {
        this.closeModalWithFlipAnimation();
      }
    });

    // キーボードショートカット
    window.addEventListener('keydown', (e) => {
      const isMatModalOpen = this.materialModalOverlay && this.materialModalOverlay.classList.contains('active');
      const isModalOpen = this.modalOverlay.classList.contains('active');

      if (e.key === 'Escape') {
        if (isMatModalOpen) {
          e.preventDefault();
          this.closeMaterialModal();
          return;
        }
        if (isModalOpen) {
          this.closeModalWithFlipAnimation();
          return;
        }
      }

      // 資料モーダルが開いている場合はスライドのキーボード送りを抑制
      if (isMatModalOpen) {
        return;
      }

      if (isModalOpen) {
        if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.modalNext();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.modalPrev();
        }
      } else {
        // TL上でのキーボード操作
        if (e.key === ' ' || e.key === 'n' || e.key === 'N') {
          // 入力フォームやモーダルが開いていなければ次のスライド返信
          if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            this.postNextSlideReply();
          }
        }
      }
    });

    // Markdown モーダルの開閉
    if (this.btnOpenMdModal) {
      this.btnOpenMdModal.addEventListener('click', () => {
        this.mdTextarea.value = getDefaultMd();
        this.mdModalOverlay.classList.add('active');
      });
    }
    if (this.btnCloseMdModal) {
      this.btnCloseMdModal.addEventListener('click', () => {
        this.mdModalOverlay.classList.remove('active');
      });
    }
    if (this.btnApplyMd) {
      this.btnApplyMd.addEventListener('click', () => {
        const md = this.mdTextarea.value;
        if (md.trim()) {
          // plan.mdのスライドデータを再生成してリセット
          this.resetTimeline();
          this.mdModalOverlay.classList.remove('active');
        }
      });
    }
    if (this.btnLoadPlanMd) {
      this.btnLoadPlanMd.addEventListener('click', () => {
        this.mdTextarea.value = getDefaultMd();
      });
    }
  }
}

// ブラウザのスクロール位置自動復元を無効化（毎回必ず一番上・最初から表示する）
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// アプリの起動と初期位置リセット
document.addEventListener('DOMContentLoaded', () => {
  window.scrollTo(0, 0);
  window.slideApp = new SlideDeckApp();
});

window.addEventListener('load', () => {
  window.scrollTo(0, 0);
});
