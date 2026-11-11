/* ==========================================================
   components.js — 部品の動き（依存なし・読み込むだけで動く）
   使い方：<script src="js/components.js" defer></script>
   HTML の class / data 属性を見て自動で動く。あとから追加した要素は OKALC.init(要素) で有効にする
   ========================================================== */
(() => {
  const qa = (root, sel) => [...root.querySelectorAll(sel)];
  // 画面に浮かせて出すもの（セレクトの一覧・ツールチップ・トースト）の置き場所。
  // <dialog> を showModal() で開いていると、そのダイアログがいちばん前（最前面）に出て、body に置いたものは後ろに隠れて押せない。
  // そのため、部品がダイアログの中にあればそのダイアログへ、開いているダイアログがあればそこへ置く。無ければ body
  const layerFor = (el) => el?.closest('dialog') || [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  // 部品ごとに document へ監視を足すと、描き直すたびに増え続ける。監視は1本ずつにまとめ、部品はここに登録する。
  // 要素が消えたら sweep で登録を外し、body の直下に出したもの（一覧・ツールチップ）も片付ける
  const parts = new Set();   // { el, onReset?, onClick?, onScroll?, cleanup? }
  const sweep = () => parts.forEach((p) => { if (!p.el.isConnected) { p.cleanup?.(); parts.delete(p); } });
  document.addEventListener('reset', (e) => parts.forEach((p) => p.el.isConnected && p.onReset?.(e)));
  document.addEventListener('click', (e) => parts.forEach((p) => p.el.isConnected && p.onClick?.(e)));
  addEventListener('scroll', (e) => parts.forEach((p) => p.el.isConnected && p.onScroll?.(e)), { passive: true, capture: true });

  /* ── タブ（WAI-ARIA Tabs）：role="tablist" の中の role="tab"。←→ Home End で移動 */
  function initTabs(root) {
    qa(root, '[role="tablist"]:not([data-ok])').forEach((list) => {
      list.dataset.ok = '';
      const tabs = qa(list, '[role="tab"]');
      const select = (t, focus = true) => {
        tabs.forEach((x) => {
          const on = x === t;
          x.setAttribute('aria-selected', String(on));
          x.tabIndex = on ? 0 : -1;
          const p = document.getElementById(x.getAttribute('aria-controls'));
          if (p) p.hidden = !on;
        });
        if (focus) t.focus();
      };
      tabs.forEach((t, i) => {
        t.addEventListener('click', () => select(t));
        t.addEventListener('keydown', (e) => {
          const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
          if (e.key in map) { e.preventDefault(); select(tabs[(map[e.key] + tabs.length) % tabs.length]); }
        });
      });
    });
  }

  /* ── セレクト（WAI-ARIA Select-only Combobox）：.c-select[data-select] */
  let selectId = 0;
  function initSelects(root) {
    qa(root, '.c-select[data-select]:not([data-ok])').forEach((sel) => {
      sel.dataset.ok = '';
      const trigger = sel.querySelector('.c-select__trigger');
      const value = sel.querySelector('.c-select__value');
      const items = qa(sel, '[role="option"]:not([aria-disabled="true"])');
      let active = Math.max(0, items.findIndex((x) => x.getAttribute('aria-selected') === 'true'));
      let typed = ''; let typedTimer;
      // フォームで送る値：中の <input type="hidden" class="c-select__input" name="…"> に入れる。
      // 必須は data-required（hidden には required を付けられないので、検証は initForms がこれを見る）
      const input = sel.querySelector('.c-select__input');
      const placeholder = value.classList.contains('is-placeholder') ? value.textContent : '';
      const valueOf = (x) => x.dataset.value ?? x.textContent.trim();
      if (input) {
        if (input.hasAttribute('data-required')) trigger.setAttribute('aria-required', 'true');
        if (!trigger.id) trigger.id = `${input.name || 'c-select'}-trigger-${++selectId}`;   // エラーのまとめからリンクで飛べるように
        const picked = items.find((x) => x.getAttribute('aria-selected') === 'true');
        if (picked && !input.value) input.value = valueOf(picked);
        // form の reset で、見た目も送る値も最初の状態に戻す（hidden は value を変えると最初の値も変わるので、ここで覚えておく）
        const initial = input.value;
        // 後から form に入れた場合も拾えるよう、reset は document で受けて自分の form かを見る
        parts.add({ el: sel, onReset: (e) => e.target === input.form && setTimeout(() => {
          input.value = initial;
          const hit = items.find((x) => valueOf(x) === input.value);
          items.forEach((x) => x.setAttribute('aria-selected', String(x === hit)));
          value.textContent = hit ? hit.textContent.trim() : placeholder;
          value.classList.toggle('is-placeholder', !hit);
        }) });
      }
      const setActive = (i) => {
        active = (i + items.length) % items.length;
        items.forEach((x, j) => x.classList.toggle('is-active', j === active));
        trigger.setAttribute('aria-activedescendant', items[active].id);
        items[active].scrollIntoView({ block: 'nearest' });
      };
      const menu = sel.querySelector('.c-menu');
      // 一覧は body の直下へ移し、画面上の位置で出す（ヘッダー・モーダルなど、ぼかしや動きの指定がある枠の中でもずれず、表やカードの枠でも切れない）。
      // 下に入り切らないときは上に出す
      menu.hidden = true;
      menu.classList.add('is-floating');
      layerFor(sel).appendChild(menu);
      const place = () => {
        const r = trigger.getBoundingClientRect(); const gap = 4;
        menu.classList.add('is-floating');
        menu.style.minInlineSize = '0';
        const h = menu.offsetHeight;
        menu.style.left = `${Math.max(gap, Math.min(r.left, innerWidth - menu.offsetWidth - gap))}px`;
        menu.style.top = `${innerHeight - r.bottom - gap < h && r.top > h + gap ? r.top - gap - h : r.bottom + gap}px`;
      };
      const onMove = () => { if (sel.classList.contains('is-open')) place(); };
      const open = () => {
        sel.classList.add('is-open'); menu.hidden = false; trigger.setAttribute('aria-expanded', 'true'); place(); setActive(active);
        addEventListener('scroll', onMove, { passive: true, capture: true }); addEventListener('resize', onMove);
      };
      const close = () => {
        sel.classList.remove('is-open'); menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
        removeEventListener('scroll', onMove, { capture: true }); removeEventListener('resize', onMove);
      };
      const choose = (i) => {
        items.forEach((x) => x.setAttribute('aria-selected', 'false'));
        items[i].setAttribute('aria-selected', 'true');
        value.textContent = items[i].textContent.trim();
        value.classList.remove('is-placeholder');
        active = i; close(); trigger.focus();
        if (input) { input.value = valueOf(items[i]); input.dispatchEvent(new Event('change', { bubbles: true })); }   // フォームの検証がエラーを消せるように
        sel.dispatchEvent(new CustomEvent('change', { detail: { value: valueOf(items[i]) } }));
      };
      trigger.addEventListener('click', () => (sel.classList.contains('is-open') ? close() : open()));
      trigger.addEventListener('keydown', (e) => {
        const isOpen = sel.classList.contains('is-open');
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); isOpen ? setActive(active + (e.key === 'ArrowDown' ? 1 : -1)) : open(); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isOpen ? choose(active) : open(); }
        else if (e.key === 'Escape' && isOpen) { e.preventDefault(); close(); }   // 一覧だけを閉じる（モーダルの中でも、モーダルまでは閉じない）
        else if (e.key === 'Escape' || e.key === 'Tab') close();
        else if (e.key === 'Home' && isOpen) { e.preventDefault(); setActive(0); }
        else if (e.key === 'End' && isOpen) { e.preventDefault(); setActive(items.length - 1); }
        else if (e.key.length === 1) {           // 文字を打つと、その文字で始まる項目へ移動
          typed += e.key; clearTimeout(typedTimer); typedTimer = setTimeout(() => { typed = ''; }, 500);
          const hit = items.findIndex((x) => x.textContent.trim().startsWith(typed));
          if (hit >= 0) { if (!isOpen) open(); setActive(hit); }
        }
      });
      items.forEach((x, i) => { x.addEventListener('click', () => choose(i)); x.addEventListener('mousemove', () => setActive(i)); });
      parts.add({ el: sel, onClick: (e) => { if (!sel.contains(e.target) && !menu.contains(e.target)) close(); }, cleanup: () => menu.remove() });
      // 一覧の項目はフォーカスを受けないので、押したときにフォーカスが外れて「欄を離れた」扱い（必須のエラー）にならないよう止める
      menu.addEventListener('mousedown', (e) => e.preventDefault());
    });
  }

  /* ── テキストエリア：.c-textarea-box。高さを中身に合わせる（field-sizing 未対応のとき）＋ 文字数 */
  const fieldSizing = CSS.supports('field-sizing', 'content');
  function initTextareas(root) {
    qa(root, '.c-textarea-box:not([data-ok])').forEach((box) => {
      box.dataset.ok = '';
      const ta = box.querySelector('.c-textarea');
      const count = box.querySelector('.c-textarea__count');
      // 上限を超えても打てるようにする（maxlength のままだと、それ以上は入力できない）。
      // JS が動かないときは maxlength がそのまま効くので、上限は守られる
      const max = Number(ta.getAttribute('maxlength') || ta.dataset.maxlength) || 0;
      if (max) { ta.dataset.maxlength = max; ta.removeAttribute('maxlength'); }
      // 超えた文字の背景を赤くする写し。textarea の裏に同じ文字を重ねる（文字は透明で、背景の色だけが見える）
      let mirror;
      if (max) {
        mirror = document.createElement('div');
        mirror.className = 'c-textarea__mirror';
        mirror.setAttribute('aria-hidden', 'true');
        box.insertBefore(mirror, ta);
      }
      // 読み上げ：文字数は1文字ごとには読まない（うるさい）。上限を超えたとき・戻ったときだけ知らせる
      let live; let wasOver = false;
      if (max) {
        live = document.createElement('span');
        live.className = 'u-visually-hidden';
        live.setAttribute('aria-live', 'polite');
        box.appendChild(live);
      }
      const update = () => {
        if (!fieldSizing) { ta.style.blockSize = 'auto'; ta.style.blockSize = `${ta.scrollHeight}px`; }
        if (!max) return;
        const chars = [...ta.value]; const over = chars.length - max;
        if ((over > 0) !== wasOver) { wasOver = over > 0; live.textContent = wasOver ? `${max}文字を超えました` : `${max}文字以内になりました`; }
        if (count) { count.textContent = `${chars.length} / ${max}`; count.classList.toggle('is-over', over > 0); }
        mirror.textContent = chars.slice(0, max).join('');
        if (over > 0) { const m = document.createElement('mark'); m.className = 'c-textarea__over'; m.textContent = chars.slice(max).join(''); mirror.appendChild(m); }
        mirror.append('\u200b');   // 最後の改行も高さに入れる
        // 送信時にエラーで止める（data-validate のフォームは checkField がこの文言を出す）
        ta.setCustomValidity(over > 0 ? (ta.dataset.errorMaxlength || `${max}文字以内で入力してください（${over}文字多い）`) : '');
      };
      // JS で値を入れたときは ta.dispatchEvent(new Event('input')) を送ると表示が合う。form の reset も拾う
      ta.addEventListener('input', update);
      parts.add({ el: box, onReset: (e) => e.target === ta.form && setTimeout(update) });
      ta.addEventListener('scroll', () => { if (mirror) mirror.scrollTop = ta.scrollTop; });
      update();
    });
  }

  /* ── ツールチップ：.c-tooltip-wrap の中の .c-tooltip。
        body の直下へ移して、画面上の位置で出す（ヘッダー・目次・モーダルなど、ぼかしや動きの指定がある枠の中でもずれず、表の枠でも切れない）。
        マウスを乗せて 0.3 秒・フォーカスですぐ出る。ツールチップの上へポインターを移しても消えない。Esc で閉じる（WCAG 1.4.13）。
        最初から is-open が付いているもの（まとめサイトの見本）は出したままにする */
  const tipPlacers = new Map();
  function initTooltips(root) {
    // 画面上部に固定されたヘッダー（まとめサイトの data-sticky-header・公開サイトの c-header・管理画面の a-topbar）の下に出す
    const header = document.querySelector('[data-sticky-header], .c-header, .a-topbar');
    qa(root, '.c-tooltip-wrap:not([data-ok])').forEach((w) => {
      w.dataset.ok = '';
      const tips = qa(w, ':scope > .c-tooltip:not(.c-tooltip--done)');   // コピーの「コピーしました」は部品の中に残す
      if (!tips.length) return;
      tips.forEach((tip) => {
        if (tip.classList.contains('is-open')) tip.dataset.pinned = '';
        tip.classList.add('c-tooltip--floating');
        layerFor(w).appendChild(tip);
      });
      const place = () => tips.forEach((tip) => {
        const r = w.getBoundingClientRect(); const gap = 8;
        const top = header ? header.getBoundingClientRect().bottom : 0;
        const above = r.top - gap - tip.offsetHeight;
        const below = above < top;   // 上に入らないときは下に出す
        tip.style.left = `${Math.max(gap, Math.min(r.left + r.width / 2 - tip.offsetWidth / 2, innerWidth - tip.offsetWidth - gap))}px`;
        tip.style.top = `${below ? r.bottom + gap : above}px`;
      });
      let timer;
      const show = (d) => { clearTimeout(timer); timer = setTimeout(() => { place(); tips.forEach((t) => t.classList.add('is-open')); }, d); };
      const hide = () => { clearTimeout(timer); tips.forEach((t) => { if (!('pinned' in t.dataset)) t.classList.remove('is-open'); }); };
      const hideSoon = () => { clearTimeout(timer); timer = setTimeout(hide, 150); };
      w.addEventListener('mouseenter', () => show(300));
      w.addEventListener('mouseleave', hideSoon);
      w.addEventListener('focusin', () => show(0));
      w.addEventListener('focusout', hide);
      w.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
      tips.forEach((t) => { t.addEventListener('mouseenter', () => clearTimeout(timer)); t.addEventListener('mouseleave', hideSoon); });
      tipPlacers.set(w, { place, tips });
      if (tips.some((t) => 'pinned' in t.dataset)) requestAnimationFrame(place);
    });
  }
  // 画面に固定して出しているので、スクロール・画面の大きさが変わったら置き直す（置き直さないと、出したままの位置に残って画面に付いてくる）
  let tipFrame = 0;
  const replaceTips = () => {
    if (tipFrame) return;
    tipFrame = requestAnimationFrame(() => {
      tipFrame = 0;
      sweep(); sweepTruncTips();
      tipPlacers.forEach(({ place, tips }, w) => {
        if (!w.isConnected) { tips.forEach((t) => t.remove()); tipPlacers.delete(w); return; }   // 消えた部品は、ツールチップごと忘れる
        if (tips.some((t) => t.classList.contains('is-open'))) place();   // 出ているものだけ置き直す
      });
    });
  };
  addEventListener('scroll', replaceTips, { passive: true, capture: true });
  addEventListener('resize', replaceTips);
  // ページの高さが変わったとき（アコーディオンや「コードを表示」を開いたときなど）も置き直す
  if ('ResizeObserver' in window) document.addEventListener('DOMContentLoaded', () => new ResizeObserver(replaceTips).observe(document.body));


  /* ── 省略表示：.c-truncate。「…」になったときだけ全文のツールチップを出す（body 直下に置くので表の枠で切れない） */
  let tipId = 0;
  const truncTips = new Map();   // 省略した要素 → body の直下に作った全文のツールチップ
  // 行を描き直すなどで要素が消えたら、ツールチップも消す（init のたびと、スクロール・画面の大きさの変化のたびに見る）
  const sweepTruncTips = () => truncTips.forEach(({ tip, ro }, el) => { if (!el.isConnected) { tip.remove(); ro?.disconnect(); truncTips.delete(el); } });
  function initTruncate(root) {
    sweepTruncTips();
    const header = document.querySelector('[data-sticky-header], .c-header, .a-topbar');
    qa(root, '.c-truncate:not([data-ok])').forEach((el) => {
      el.dataset.ok = '';
      const tip = document.createElement('span');
      tip.className = 'c-tooltip c-tooltip--floating';
      tip.setAttribute('role', 'tooltip');
      tip.id = `c-trunc-tip-${++tipId}`;
      // 全文は見えている文字だけで作る（読み上げ用の u-visually-hidden は画面に出さない。2026-10-04）
      const shownText = el.cloneNode(true);
      shownText.querySelectorAll('.u-visually-hidden').forEach((n) => n.remove());
      tip.textContent = shownText.textContent.trim();
      layerFor(el).appendChild(tip);
      // 「…」になっているかは、幅が変わるたびに見直す（閉じたタブの中・フォントの読み込み後・画面幅の変化）。
      // 省略されているときだけフォーカスでき、全文のツールチップとつながる
      const isCut = () => el.scrollWidth > el.clientWidth;
      const shown = () => el.getClientRects().length > 0;   // 表やタブが隠れると 0
      const check = () => {
        if (!shown()) tip.classList.remove('is-open');      // 元の文字が隠れたら、全文のツールチップも閉じる
        const cut = isCut();
        if (cut) { el.tabIndex = 0; el.setAttribute('aria-describedby', tip.id); }
        else { el.removeAttribute('tabindex'); el.removeAttribute('aria-describedby'); }
      };
      check();
      const ro = 'ResizeObserver' in window ? new ResizeObserver(check) : null;
      ro?.observe(el);
      truncTips.set(el, { tip, ro });
      let timer;
      const place = () => {
        const r = el.getBoundingClientRect(); const gap = 8;
        const top = header ? header.getBoundingClientRect().bottom : 0;
        const above = r.top - gap - tip.offsetHeight;
        tip.style.left = `${Math.min(r.left, innerWidth - tip.offsetWidth - gap)}px`;
        tip.style.top = `${above >= top ? above : r.bottom + gap}px`;   // 上に入らないときは下に出す
      };
      const show = (d) => { clearTimeout(timer); if (!isCut()) return; timer = setTimeout(() => { if (shown()) { place(); tip.classList.add('is-open'); } }, d); };
      const hide = () => { clearTimeout(timer); tip.classList.remove('is-open'); };
      const hideSoon = () => { clearTimeout(timer); timer = setTimeout(hide, 150); };
      el.addEventListener('mouseenter', () => show(300));
      el.addEventListener('focus', () => show(0));
      el.addEventListener('mouseleave', hideSoon);
      el.addEventListener('blur', hide);
      el.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
      tip.addEventListener('mouseenter', () => clearTimeout(timer));
      tip.addEventListener('mouseleave', hideSoon);
      parts.add({ el, onScroll: hide });   // 表の枠の中のスクロールでも閉じる
    });
  }

  /* ── コピー：[data-copy="対象のid"]。押すと中身をコピーし、隣の .c-tooltip--done を 1.5 秒出す */
  function initCopy(root) {
    qa(root, '[data-copy]:not([data-ok])').forEach((b) => {
      b.dataset.ok = '';
      const tip = b.parentElement.querySelector('.c-tooltip--done');
      let timer;
      b.addEventListener('click', async () => {
        const src = document.getElementById(b.dataset.copy);
        try { await navigator.clipboard.writeText(src.value ?? src.textContent); } catch (e) { /* 失敗しても表示は出す */ }
        if (!tip) return;
        clearTimeout(timer); tip.classList.add('is-open');
        timer = setTimeout(() => tip.classList.remove('is-open'), 1500);
      });
    });
  }

  /* ── モーダル：[data-modal-open="id"] で開く、[data-modal-close] で閉じる。
        開くとフォーカスを中へ移し、Tab は中だけを回る。Esc で閉じ、閉じたら開いたボタンへ戻す */
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  // 画面に出ていないもの（hidden・display:none など）は、フォーカスの行き先から外す
  const focusables = (el) => qa(el, FOCUSABLE).filter((x) => !x.hidden && x.getClientRects().length > 0);
  function openModal(id, opener) {
    const bd = document.getElementById(id);
    if (!bd) return;
    if (!bd.hidden && !bd.classList.contains('is-leaving')) return; // すでに開いている
    clearTimeout(bd._timer);
    bd.hidden = false;
    bd.classList.remove('is-leaving');
    document.documentElement.style.overflow = 'hidden'; // 背景をスクロールさせない
    const modal = bd.querySelector('.c-modal');
    const f = focusables(modal);
    (modal.querySelector('[autofocus]') || f[0] || modal).focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { if (e.defaultPrevented) return; e.preventDefault(); close(); }   // 中の部品（セレクトの一覧など）が先に閉じたときは何もしない
      if (e.key === 'Tab') {
        const list = focusables(modal); const first = list[0]; const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const close = () => {
      bd.classList.add('is-leaving');
      const done = () => { if (!bd.classList.contains('is-leaving')) return; bd.hidden = true; bd.classList.remove('is-leaving'); clearTimeout(bd._timer); };
      bd.addEventListener('animationend', done, { once: true });
      bd._timer = setTimeout(done, 300); // アニメーションが動かない環境（動きを減らす設定など）でも必ず閉じる
      document.documentElement.style.overflow = '';
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
    bd._close = close;
    document.addEventListener('keydown', onKey);
  }
  function initModals(root) {
    qa(root, '[data-modal-open]:not([data-ok])').forEach((b) => { b.dataset.ok = ''; b.addEventListener('click', () => openModal(b.dataset.modalOpen, b)); });
    qa(root, '[data-modal-close]:not([data-ok])').forEach((b) => { b.dataset.ok = ''; b.addEventListener('click', () => b.closest('.c-modal-backdrop')._close?.()); });
  }

  /* ── トースト：OKALC.toast('保存しました', { type: 'success' | 'error' | 'info' })
        成功・情報は --toast-duration（5秒）で消える。マウスを乗せている間・フォーカス中は止める。エラーは自動で消さない */
  const ICON = { success: 'check_circle_fill1', error: 'error_fill1', info: 'info_fill1' };
  // ⚠️ icon は HTML としてそのまま入れる。デザインシステムのアイコン（SVG の文字列）だけを渡し、利用者の入力は渡さない
  //    （渡すと、書かれたスクリプトが動いてしまう）。文言（message）は文字として入れるので何を渡してもよい
  function toast(message, { type = 'success', icon = '' } = {}) {
    const region = toastRegion();
    const el = document.createElement('div');
    el.className = `c-toast c-toast--${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `${icon}<span class="c-toast__text"></span><button class="c-toast__close" type="button" aria-label="閉じる">${OKALC.closeIcon || '×'}</button>`;
    el.querySelector('.c-toast__text').textContent = message;
    region.appendChild(el);
    setupToast(el);
    return el;
  }
  // 閉じるボタンと、時間で消す動き。サーバーが最初から .c-toast-region の中に書き出したトーストにも付ける（initToasts）
  function setupToast(el) {
    if ('ok' in el.dataset) return;
    el.dataset.ok = '';
    let close = el.querySelector('.c-toast__close');
    if (!close) {
      close = document.createElement('button');
      close.className = 'c-toast__close'; close.type = 'button'; close.setAttribute('aria-label', '閉じる');
      // アイコンは OKALC.closeIcon。まだ入っていなければ、ページの <template id="tpl-icon-close"> を読む
      close.innerHTML = OKALC.closeIcon || document.getElementById('tpl-icon-close')?.innerHTML || '×';
      el.appendChild(close);
    }
    const remove = () => { el.classList.add('is-leaving'); el.addEventListener('animationend', () => el.remove(), { once: true }); setTimeout(() => el.remove(), 400); };
    close.addEventListener('click', remove);
    if (el.classList.contains('c-toast--error')) return;   // エラーは自動で消さない（閉じるボタンで消す）
    // 時間で消す。マウス・フォーカスが乗っている間と、タブが裏にある間は数えない（一度も見えないうちに消えるのを防ぐ）
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--toast-duration')) || 5000;
    let timer = null; let held = document.hidden ? 1 : 0;
    const stop = () => { held++; clearTimeout(timer); timer = null; };
    const start = () => { if (held > 0) held--; if (held > 0 || timer !== null) return; timer = setTimeout(remove, ms); };
    el.addEventListener('mouseenter', stop); el.addEventListener('mouseleave', start);
    el.addEventListener('focusin', stop); el.addEventListener('focusout', start);
    const onVisibility = () => {
      if (!el.isConnected) { document.removeEventListener('visibilitychange', onVisibility); return; }
      if (document.hidden) stop(); else start();
    };
    document.addEventListener('visibilitychange', onVisibility);
    if (!held) timer = setTimeout(remove, ms);
  }
  // サーバーが最初から書き出したトースト。開いた時点で読み上げの領域にある文字は読まれないことが多いので、
  // いったん外して少しあとに入れ直す（入れ直したときに読み上げられる）
  function initToasts(root) {
    qa(root, '.c-toast-region .c-toast:not([data-ok])').forEach((el) => {
      const region = el.parentElement;
      setupToast(el);
      el.remove();
      setTimeout(() => region.appendChild(el), 100);
    });
  }


  /* ── フォームの検証：form[data-validate]
        ・入力中は出さない。欄を離れたときと、送信したときにエラーを出す
        ・直したら、その場でエラーを消す
        ・送信時にエラーがあれば、先頭の .c-error-summary に一覧（各項目へのリンク）を出してフォーカスする
        ・エラーが無ければ 'ds:valid' イベントを出す
        ・form に data-done-url（完了画面の URL）があれば、そのまま送信まで行う：
          ボタンを「送信中」にする → action へ送る（action が無い見本は送ったことにする）→ 完了画面へ移る。
          送れなかったらボタンを戻してエラーのトースト（文言は data-send-error で上書き）。送信中は二重に送らない
          画面が自分で送るときは ds:valid で e.preventDefault() する
        文言：data-error-required / data-error-type / data-error-pattern / data-error-minlength を付けると上書きできる */
  function labelOf(ctrl) {
    const set = ctrl.closest('.c-formset');
    return (set?.querySelector('.c-label')?.textContent || ctrl.getAttribute('aria-label') || '').trim();
  }
  // セレクト（c-select）の送る値は hidden なので、ブラウザの検証の対象にならない。必須だけここで見る
  const isSelectInput = (c) => c.matches('.c-select__input');
  const isValid = (c) => (isSelectInput(c) ? !(c.hasAttribute('data-required') && !c.value) : c.checkValidity());
  // フォーカスを移す先。セレクトは開くボタン
  const focusTarget = (c) => (isSelectInput(c) ? c.closest('.c-select')?.querySelector('.c-select__trigger') : null) || c;
  function messageOf(ctrl) {
    if (isSelectInput(ctrl)) return ctrl.dataset.errorRequired || `${labelOf(ctrl)}を選択してください`;
    const v = ctrl.validity; const d = ctrl.dataset; const label = labelOf(ctrl);
    const choose = ctrl.type === 'checkbox' || ctrl.type === 'radio' || ctrl.tagName === 'SELECT';
    if (v.valueMissing) return d.errorRequired || `${label}を${choose ? '選択' : '入力'}してください`;
    if (v.typeMismatch) return d.errorType || (ctrl.type === 'email' ? 'メールアドレスの形式で入力してください' : `${label}の形式で入力してください`);
    if (v.patternMismatch) return d.errorPattern || `${label}の形式で入力してください`;
    if (v.tooShort) return d.errorMinlength || `${ctrl.minLength}文字以上で入力してください`;
    if (v.tooLong) return `${ctrl.maxLength}文字以内で入力してください`;
    return ctrl.validationMessage;
  }
  function setError(ctrl, msg) {
    const set = ctrl.closest('.c-formset');
    if (!set) return;
    const group = set.querySelectorAll('input:not([type="hidden"]), select, textarea, .c-select__trigger');
    let err = set.querySelector(':scope > .c-formset__error');
    if (msg) {
      if (!err) {
        err = document.createElement('p');
        err.className = 'c-formset__error';
        err.id = `${ctrl.id || ctrl.name || 'field'}-err`;
        err.innerHTML = `${OKALC.errorIcon || ''}<span></span>`;
        set.appendChild(err);
      }
      err.querySelector('span') ? (err.querySelector('span').textContent = msg) : (err.textContent = msg);
      group.forEach((c) => {
        c.setAttribute('aria-invalid', 'true');
        const ids = new Set((c.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)); ids.add(err.id);
        c.setAttribute('aria-describedby', [...ids].join(' '));
      });
    } else {
      group.forEach((c) => c.removeAttribute('aria-invalid'));
      err?.remove();
    }
  }
  function checkField(ctrl) {
    const group = ctrl.closest('.c-formset')?.querySelectorAll('input, select, textarea') ?? [ctrl];
    const bad = [...group].find((c) => !isValid(c));
    setError(ctrl, bad ? messageOf(bad) : '');
    return !bad;
  }
  /* ── 前の画面に戻る：[data-back]
        押したら、ブラウザの1つ前のページへ戻る（どこから来ても同じ動き） */
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) { e.preventDefault(); history.back(); }
  });
  /* ── 送信 → 完了画面：form[data-validate][data-done-url]
        送信中は押したボタンを loading にして二重に送らない。送れたら data-done-url（完了画面）へ移る。
        送れなかったら loading を戻し、エラーのトーストで知らせる（入力は残す）。
        action が無いフォーム（まとめサイトの見本・練習課題）は送らずに完了画面へ移る */
  function sendAndGo(form, submitter) {
    const btn = (submitter && submitter.type === 'submit' ? submitter : null) || form.querySelector('[type="submit"]');
    const label = btn ? btn.innerHTML : '';
    if (btn) {
      btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true');
      btn.innerHTML = `<span class="c-spinner c-spinner--md" aria-hidden="true">${'<i></i>'.repeat(9)}</span>送信中`;
    }
    const done = () => location.assign(form.dataset.doneUrl);
    const action = form.getAttribute('action');
    if (!action) { setTimeout(done, 800); return; }
    fetch(action, { method: (form.getAttribute('method') || 'post').toUpperCase(), body: new FormData(form), credentials: 'same-origin' })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); done(); })
      .catch(() => {
        if (btn) { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); btn.innerHTML = label; }
        const tpl = document.getElementById('tpl-icon-error');
        toast(form.dataset.sendError || '送信できませんでした。時間をおいてもう一度お試しください。', { type: 'error', icon: tpl ? tpl.innerHTML : '' });
      });
  }
  function initForms(root) {
    qa(root, 'form[data-validate]:not([data-ok])').forEach((form) => {
      form.dataset.ok = ''; form.noValidate = true;
      const summary = form.querySelector('.c-error-summary');
      // form の reset で、項目の下のエラーと先頭のまとめも消す
      parts.add({ el: form, onReset: (e) => e.target === form && setTimeout(() => {
        qa(form, '.c-formset').forEach((set) => { const c = set.querySelector('input, select, textarea'); if (c) setError(c, ''); });
        summary?.classList.remove('is-shown');
        const list = summary?.querySelector('.c-error-summary__list'); if (list) list.innerHTML = '';
      }) });
      form.addEventListener('focusout', (e) => {
        const c = e.target;
        if (!(c instanceof HTMLElement) || !c.matches('input, select, textarea, .c-select__trigger')) return;
        if (c.closest('.c-formset')?.contains(e.relatedTarget)) return; // 同じ項目の中で移動しているときはまだ出さない（セレクトの一覧の中も同じ項目）
        checkField(c.closest('.c-select')?.querySelector('.c-select__input') || c);
      });
      form.addEventListener('input', (e) => { const c = e.target; if (c.getAttribute('aria-invalid') === 'true') checkField(c); });
      form.addEventListener('change', (e) => {
        const c = e.target;
        const shown = isSelectInput(c) ? c.closest('.c-select').querySelector('.c-select__trigger') : c;
        if (shown?.getAttribute('aria-invalid') === 'true') checkField(c);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (form.querySelector('[type="submit"].is-loading')) return;   // 送信中にもう一度押されても二重に送らない
        const sets = qa(form, '.c-formset').filter((s) => s.querySelector('input, select, textarea'));
        const errors = [];
        sets.forEach((s) => { const c = s.querySelector('input, select, textarea'); if (!checkField(c)) errors.push(c); });
        if (summary) {
          summary.classList.toggle('is-shown', errors.length > 0);
          const list = summary.querySelector('.c-error-summary__list');
          if (list) {
            list.innerHTML = '';
            errors.forEach((c) => {
              const li = document.createElement('li'); const a = document.createElement('a');
              const to = focusTarget(c);
              a.href = `#${to.id || c.id}`; a.textContent = messageOf(c.closest('.c-formset').querySelector(':invalid') || c);
              a.addEventListener('click', (ev) => { ev.preventDefault(); to.focus(); });
              li.appendChild(a); list.appendChild(li);
            });
          }
          const title = summary.querySelector('.c-alert__title');
          if (title) title.textContent = `入力内容を確認してください（${errors.length}件）`;
        }
        if (errors.length) { (summary || focusTarget(errors[0])).focus(); return; }
        // エラーが無い：ds:valid を出す。画面が自分で送るときは e.preventDefault() する。
        // しないときは、data-done-url があれば部品が送って完了画面へ移る（送信したら入力を画面に残さない決まり）
        const go = form.dispatchEvent(new CustomEvent('ds:valid', { bubbles: true, cancelable: true }));
        if (go && form.dataset.doneUrl) sendAndGo(form, e.submitter);
      });
    });
  }


  // トーストの置き場所。ダイアログを開いている間は、そのダイアログの中に置き場所を作る（後ろに隠れないように）
  function toastRegion() {
    const host = layerFor(null);
    let region = host.querySelector(':scope > .c-toast-region');
    if (!region) { region = document.createElement('div'); region.className = 'c-toast-region'; host.appendChild(region); }
    // 置き場所には aria-live を付けない。トースト自身の role（成功は status・エラーは alert）で読ませる（二重に読まれないように）
    region.removeAttribute('aria-live');
    return region;
  }

  // 1つの部品の HTML が崩れていても、ほかの部品は動くように、部品ごとに分けて初期化する
  function init(root = document) {
    sweep();
    [initTabs, initSelects, initTextareas, initTooltips, initTruncate, initCopy, initModals, initForms, initToasts].forEach((fn) => {
      try { fn(root); } catch (e) { console.error(`OKALC: ${fn.name} で止まりました（HTML の形を確かめてください）`, e); }
    });
    if (root === document && document.body) toastRegion();
  }
  const OKALC = { init, toast, openModal, ICON, closeIcon: '', errorIcon: '' };
  window.OKALC = OKALC;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
})();
