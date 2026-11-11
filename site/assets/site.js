// まとめサイト専用の JS（部品の動きは js/components.js）
(() => {
  // ── サイトのメニュー（スマホ幅）
  const btn = document.querySelector('.ds-menu-btn');
  const nav = document.getElementById('ds-nav');
  btn?.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('is-open', !open);
  });

  // ── トーストのアイコン（ビルド時に埋め込んだ SVG を使う）
  const tpl = (id) => document.getElementById(id)?.innerHTML ?? '';
  if (window.OKALC) { OKALC.closeIcon = tpl('tpl-icon-close'); OKALC.errorIcon = tpl('tpl-icon-error'); }
  document.querySelectorAll('[data-toast]').forEach((b) => {
    b.addEventListener('click', () => {
      const type = b.dataset.toast;
      OKALC.toast(b.dataset.message, { type, icon: tpl(`tpl-icon-${type}`) });
    });
  });

  // ── コードのコピー
  document.querySelectorAll('.ds-code__copy').forEach((b) => {
    const tip = b.parentElement.querySelector('.c-tooltip--done');
    let timer;
    b.addEventListener('click', async () => {
      const code = b.closest('.ds-code').querySelector('code').textContent;
      try { await navigator.clipboard.writeText(code); } catch (e) { /* 表示は出す */ }
      clearTimeout(timer); tip.classList.add('is-open');
      timer = setTimeout(() => tip.classList.remove('is-open'), 1500);
    });
  });

  // ── モーションの見本：もう一度再生
  document.querySelectorAll('[data-replay]').forEach((b) => {
    b.addEventListener('click', () => {
      const target = document.getElementById(b.dataset.replay);
      [target, ...target.querySelectorAll('*')]
        .filter((el) => getComputedStyle(el).animationName !== 'none')
        .forEach((el) => {
          const inline = el.style.animation;
          el.style.animation = 'none'; void el.offsetWidth; el.style.animation = inline;
        });
    });
  });
  // ── トグル（時間・イージングの比較）
  document.querySelectorAll('[data-toggle]').forEach((b) => {
    b.addEventListener('click', () => document.getElementById(b.dataset.toggle).classList.toggle('is-on'));
  });
})();
