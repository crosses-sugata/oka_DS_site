/* ==========================================================
   site.js — 公開サイトの部品の動き
   使い方：<script src="js/site.js" defer></script>（ページの最後で読む）
   ヘッダーの影・スマホのメニュー（c-nav--mobile）・ページ上部へ（c-floating）・記事一覧の「もっと見る」・
   目次（c-toc）・アコーディオン（c-faq / p-route）・ヒーローのスライド（p-hero）・ふわっと出る動き（u-reveal）
   ⚠️ u-reveal を使うページでこれを読まないと、opacity: 0 のままで画面が真っ白になる
   ========================================================== */
(function () {
  'use strict';

  /* 全ページ共通のヘッダー・ナビ挙動。index.html と news/ essay/ の生成ページで共有する。 */

  // ヘッダー: スクロールでシャドウ付与
  // ヘッダーの無いページ（まとめサイトの見本など）でも下の処理が止まらないよう、無いときは飛ばす
  var header = document.getElementById('site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // モバイルナビ
  // ⚠️ **要素が無い場合を必ず見ること。** エラーページはヘッダーの導線を出さない
  // （header.php の $minimalChrome）。ここで null のまま addEventListener すると
  // 例外で止まり、**これより下の処理が全部動かなくなる**。
  // 下の `if (toTop)` と同じ書き方に揃えてある。
  var toggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    // メニューを開いている間は、裏の本文を操作できないようにする（Tab で裏へ移らない）
    var setInert = function (on) {
      Array.prototype.forEach.call(document.body.children, function (el) {
        if (el === mobileNav || el.contains(mobileNav) || el.contains(toggle) || el.tagName === 'SCRIPT') { return; }
        if (on) { el.setAttribute('inert', ''); } else { el.removeAttribute('inert'); }
      });
    };
    var closeNav = function () {
      setInert(false);
      mobileNav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'メニューを開く');
      document.body.style.overflow = '';
    };
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      setInert(open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    mobileNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('is-open')) {
        closeNav();
        toggle.focus();
      }
    });
    // 開いたまま画面が 1100px（--bp-header）より広くなると、開閉ボタンが消えて閉じられなくなるので閉じる
    var wide = window.matchMedia('(min-width: 1101px)');
    var onWide = function () { if (wide.matches && mobileNav.classList.contains('is-open')) { closeNav(); } };
    if (wide.addEventListener) { wide.addEventListener('change', onWide); } else if (wide.addListener) { wide.addListener(onWide); }
    window.addEventListener('resize', onWide);
  }

  // ページ上部へ戻る
  var toTop = document.getElementById('floating-top');
  if (toTop) {
    toTop.addEventListener('click', function () {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // 記事一覧: 初回は data-step 件だけ表示し、「もっと見る」で同数ずつ追加する。
  // JS が動かない環境では全件が表示されたままになる（ボタンは hidden のまま）。
  document.querySelectorAll('.c-post-list').forEach(function (list) {
    var step = parseInt(list.getAttribute('data-step'), 10) || 10;
    var items = Array.prototype.slice.call(list.children);
    var more = list.parentNode.querySelector('.c-post-list__more');
    if (!more || items.length <= step) { return; }

    var shown = 0;
    var render = function () {
      shown = Math.min(shown + step, items.length);
      items.forEach(function (li, i) { li.hidden = i >= shown; });
      more.hidden = shown >= items.length;
    };
    render();
    more.hidden = false;

    more.addEventListener('click', function () {
      var first = items[shown];
      render();
      // 追加分の先頭にフォーカスを移し、キーボード操作でも続きから読めるようにする
      if (first) {
        var link = first.querySelector('a');
        if (link) { link.setAttribute('tabindex', '-1'); link.focus({ preventScroll: true }); }
      }
    });
  });

  // 目次（サービス案内・よくある質問で共有）: ヘッダー直下に固定し、固定中は影を付ける。
  // 実測した高さを --toc-h に入れ、アンカー移動時に見出しが目次の裏に隠れないようにする。
  var toc = document.querySelector('.c-toc');
  if (toc) {
    // ヘッダーの高さ（--header-h）。CSS のトークンから読む（読めないときは 72）
    var STICKY_TOP = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 72;
    var tocLinks = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
    var tocSmooth = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    // 固定時の背景を画面幅いっぱいに広げるため、スクロールバーを除いた実幅を渡す
    var syncViewport = function () {
      document.documentElement.style.setProperty(
        '--vw', document.documentElement.clientWidth + 'px'
      );
    };
    // ヘッダー分は html の scroll-padding-top が担うため、ここでは目次の高さのみを渡す
    var syncTocHeight = function () {
      var h = Math.round(toc.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--toc-h', h + 'px');
    };
    // 現在表示中のセクションの項目に is-current を付ける
    var tocList = toc.querySelector('ul');
    var lastActive = null;
    var syncCurrent = function () {
      // 判定線は目次の少し下。アンカー移動で着地した見出しがその時点で現在地になる位置に置く
      var line = toc.getBoundingClientRect().bottom + 28;
      var active = null;
      tocLinks.forEach(function (a) {
        var sec = document.getElementById(decodeURIComponent(a.hash.slice(1)));
        if (sec && sec.getBoundingClientRect().top <= line) { active = a; }
      });
      // ページ最下部では、残りが短く判定線まで上がってこないセクションがある。
      // その場合は最後の項目を現在地とする（よくある質問の末尾カテゴリ対策）。
      var docEnd = window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (docEnd && tocLinks.length) { active = tocLinks[tocLinks.length - 1]; }
      if (active === lastActive) { return; }
      lastActive = active;
      tocLinks.forEach(function (a) {
        a.classList.toggle('is-current', a === active);
        // 今いる節を読み上げにも伝える
        if (a === active) { a.setAttribute('aria-current', 'location'); } else { a.removeAttribute('aria-current'); }
      });
      // 横スクロールする1行表示（SP）では、現在地が画面外に出ないよう追従させる
      if (active && tocList && tocList.scrollWidth > tocList.clientWidth) {
        var left = active.offsetLeft - (tocList.clientWidth - active.offsetWidth) / 2;
        tocList.scrollTo({ left: Math.max(0, left), behavior: tocSmooth });
      }
    };

    // 項目が1行に収まらないとき（主にSP）だけ、右端に送りボタンを出す。
    // JSでしか動かない操作なので、マークアップもここで作る。
    var moreBtn = null;
    if (tocList) {
      moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'c-toc__more';
      moreBtn.hidden = true;
      moreBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="m9 5 7 7-7 7"/></svg>';
      toc.appendChild(moreBtn);
    }
    var OVERFLOW_EPS = 2;
    var tocAtEnd = function () {
      return tocList.scrollLeft + tocList.clientWidth >= tocList.scrollWidth - OVERFLOW_EPS;
    };
    var syncTocMore = function () {
      if (!moreBtn) { return; }
      var overflows = tocList.scrollWidth > tocList.clientWidth + OVERFLOW_EPS;
      var atEnd = overflows && tocAtEnd();
      moreBtn.hidden = !overflows;
      toc.classList.toggle('has-more', overflows);
      toc.classList.toggle('is-at-end', atEnd);
      moreBtn.classList.toggle('is-end', atEnd);
      moreBtn.setAttribute('aria-label', atEnd ? '目次の先頭に戻る' : '目次の続きを見る');
    };
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        var step = Math.max(120, Math.round(tocList.clientWidth * 0.8));
        tocList.scrollTo({
          left: tocAtEnd() ? 0 : tocList.scrollLeft + step,
          behavior: tocSmooth
        });
      });
      tocList.addEventListener('scroll', syncTocMore, { passive: true });
    }
    var onTocScroll = function () {
      toc.classList.toggle('is-stuck', toc.getBoundingClientRect().top <= STICKY_TOP + 1);
      syncTocHeight();
      syncCurrent();
    };
    window.addEventListener('scroll', onTocScroll, { passive: true });
    window.addEventListener('resize', function () {
      syncViewport(); syncTocHeight(); syncTocMore();
    });
    syncViewport();
    syncTocHeight();
    syncTocMore();
    onTocScroll();
  }

  // アコーディオン: 高さアニメーションで開閉
  var accReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ACC_DUR = 300;
  document.querySelectorAll('.c-faq__item, .p-route__item').forEach(function (det) {
    var summary = det.querySelector('summary');
    var body = summary && summary.nextElementSibling;
    if (!summary || !body) return;
    summary.addEventListener('click', function (e) {
      if (accReduced) return; // モーション低減時はネイティブ挙動
      e.preventDefault();
      if (det.dataset.anim === '1') return;
      det.dataset.anim = '1';
      var cleanup = function () { body.style.transition = ''; body.style.overflow = ''; det.dataset.anim = ''; };
      if (det.open) {
        // 閉じる
        body.style.overflow = 'hidden';
        body.style.height = body.scrollHeight + 'px';
        void body.offsetHeight; // reflow
        body.style.transition = 'height ' + ACC_DUR + 'ms ease';
        body.style.height = '0px';
        window.setTimeout(function () { det.open = false; body.style.height = ''; cleanup(); }, ACC_DUR);
      } else {
        // 開く
        det.open = true;
        var target = body.scrollHeight;
        body.style.overflow = 'hidden';
        body.style.height = '0px';
        void body.offsetHeight; // reflow
        body.style.transition = 'height ' + ACC_DUR + 'ms ease';
        body.style.height = target + 'px';
        window.setTimeout(function () { body.style.height = ''; cleanup(); }, ACC_DUR);
      }
    });
  });

})();

// トップページだけで使う動き。
// ヒーロースライダー（5秒間隔）と .u-reveal のスクロールリビール。
// .u-reveal は、ここで html に is-reveal-ready を付けたときだけ隠れる（読み込まないときは最初から表示される）。

(function () {
  'use strict';

  // メインビジュアル: 複数枚を数秒ごとに切り替え
  document.querySelectorAll('.p-hero__slider').forEach(function (slider) {
    var slides = slider.querySelectorAll('.p-hero__slide');
    if (slides.length < 2) return;
    var idx = 0;
    window.setInterval(function () {
      slides[idx].classList.remove('is-active');
      idx = (idx + 1) % slides.length;
      slides[idx].classList.add('is-active');
    }, 5000);
  });

  // スクロールリビール
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var reveals = document.querySelectorAll('.u-reveal');
  // ここまで来たら隠してよい（CSS は html.is-reveal-ready のときだけ u-reveal を隠す）
  document.documentElement.classList.add('is-reveal-ready');
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  }

})();
