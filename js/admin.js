/* ==========================================================
   admin.js — 管理画面の部品の動き
   OkaDialog（共通の c-modal で出す）・ドロワー（a-topbar / a-side / a-scrim）・OkaToast（共通の c-toast を出す）
   使い方：<script src="js/admin.js" defer></script>
   ========================================================== */

/* ---- ダイアログ（OkaDialog） ---- */
/**
 * 投稿者用の管理画面で使う、画面中央に出るダイアログ。
 *
 * ⚠️ **`window.confirm()` `window.alert()` `window.prompt()` を使わないこと。**
 *    見た目がブラウザ任せで、見出しや補足を添えられない。何を聞かれているのか
 *    分かりにくく、入力し直しもできない。ここに用意した3つで置き換える。
 *
 *   OkaDialog.ask({ title, fields, submit, extra })  … 入力を受け取る
 *     fields の各項目：{ name, label, required, value, help（補足）, example（入力例。「例：」で始める） }。
 *     required でない項目には「任意」のタグが付く
 *   OkaDialog.confirm({ title, message, submit })     … はい／いいえ
 *   OkaDialog.notice({ title, message })              … 知らせるだけ
 *
 * いずれも Promise を返す。ask は入力値の object、キャンセルなら null。
 */
(function (global) {
  'use strict';

  /**
   * ダイアログの土台。
   *
   * `<dialog>` の showModal() を使う。背景の操作を止めるのも、Escape で閉じるのも、
   * 中にフォーカスを閉じ込めるのもブラウザがやってくれる（自前で作ると漏れる）。
   */
  var dialogCount = 0;
  function open(spec) {
    return new Promise(function (resolve) {
      // 見た目は共通部品のモーダル（c-modal）。<dialog> の showModal() で出す
      var dialog = document.createElement('dialog');
      dialog.className = 'c-modal';
      var form = document.createElement('form');
      form.className = 'c-modal__form';
      var n = ++dialogCount;

      var head = document.createElement('div');
      head.className = 'c-modal__head';
      var heading = document.createElement('h2');
      heading.className = 'c-modal__title';
      heading.textContent = spec.title;
      // 読み上げでダイアログの名前が伝わるよう、見出しとつなぐ
      heading.id = 'oka-dialog-title-' + n;
      dialog.setAttribute('aria-labelledby', heading.id);
      head.appendChild(heading);
      form.appendChild(head);

      if (spec.message) {
        var message = document.createElement('p');
        message.id = 'oka-dialog-desc-' + n;
        message.textContent = spec.message;
        dialog.setAttribute('aria-describedby', message.id);
        form.appendChild(message);
      }

      // 入力欄は共通部品のラベルセット（c-formset ＋ c-field）
      var inputs = {};
      var sets = {};
      (spec.fields || []).forEach(function (field, i) {
        var id = 'oka-dialog-' + n + '-' + i;
        var set = document.createElement('div');
        set.className = 'c-formset';
        var headRow = document.createElement('div');
        headRow.className = 'c-formset__head';
        var label = document.createElement('label');
        label.className = 'c-label';
        label.htmlFor = id;
        label.textContent = field.label;
        headRow.appendChild(label);
        // 必須か任意かを必ずタグで示す（ラベルセットの決まり。ラベルの文字に「（任意）」と書かない）
        var req = document.createElement('span');
        req.className = field.required ? 'c-req c-req--required' : 'c-req c-req--optional';
        req.textContent = field.required ? '必須' : '任意';
        headRow.appendChild(req);
        set.appendChild(headRow);
        var described = [];
        if (field.help) {
          var help = document.createElement('p');
          help.className = 'c-formset__help';
          help.id = id + '-help';
          help.textContent = field.help;
          set.appendChild(help);
          described.push(help.id);
        }
        // 入力例は補足と分けて「例：」で始まる行に出す（c-formset__example）
        if (field.example) {
          var example = document.createElement('p');
          example.className = 'c-formset__example';
          example.id = id + '-example';
          example.textContent = field.example;
          set.appendChild(example);
          described.push(example.id);
        }
        var control = document.createElement('div');
        control.className = 'c-formset__control';
        var box = document.createElement('div');
        box.className = 'c-field';
        var input = document.createElement('input');
        input.className = 'c-field__input';
        input.type = 'text';
        input.id = id;
        input.value = field.value || '';
        if (described.length) { input.setAttribute('aria-describedby', described.join(' ')); }
        box.appendChild(input);
        control.appendChild(box);
        set.appendChild(control);
        form.appendChild(set);
        inputs[field.name] = input;
        sets[field.name] = set;
      });

      // 入力が足りないときは、その項目の下にエラーを出す（共通部品の c-formset__error）
      var showError = function (name, text) {
        var set = sets[name];
        var err = set.querySelector('.c-formset__error');
        if (!err) {
          err = document.createElement('p');
          err.className = 'c-formset__error';
          err.id = inputs[name].id + '-err';
          err.innerHTML = ((global.OKALC && global.OKALC.errorIcon) || '') + '<span></span>';
          set.appendChild(err);
        }
        err.querySelector('span').textContent = text;
        inputs[name].setAttribute('aria-invalid', 'true');
        var ids = (inputs[name].getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (ids.indexOf(err.id) < 0) { ids.push(err.id); }   // 何度出しても同じ id を重ねない
        inputs[name].setAttribute('aria-describedby', ids.join(' '));
      };
      // 入れ直したらエラーを消す
      var clearError = function (name) {
        var err = sets[name].querySelector('.c-formset__error');
        if (!err) { return; }
        inputs[name].removeAttribute('aria-invalid');
        inputs[name].setAttribute('aria-describedby', (inputs[name].getAttribute('aria-describedby') || '').split(/\s+/).filter(function (x) { return x && x !== err.id; }).join(' '));
        err.remove();
      };
      Object.keys(inputs).forEach(function (name) {
        inputs[name].addEventListener('input', function () { if (inputs[name].value.trim() !== '') { clearError(name); } });
      });

      var settled = false;
      var finish = function (value) {
        if (settled) { return; }
        settled = true;
        dialog.close();
        dialog.remove();
        resolve(value);
      };

      var actions = document.createElement('div');
      actions.className = 'c-modal__foot';

      if (spec.extra) {
        var extra = document.createElement('button');
        extra.type = 'button';
        extra.className = 'c-button c-button--negative c-button--outline c-modal__extra';
        extra.textContent = spec.extra.label;
        extra.addEventListener('click', function () { finish(spec.extra.value); });
        actions.appendChild(extra);
      }

      // 知らせるだけのときは「閉じる」1つ。取り消す先が無いのに
      // 「キャンセル」を出すと、何が取り消されるのか分からない。
      var cancel = null;
      if (spec.cancel !== false) {
        cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'c-button c-button--secondary c-button--outline';
        cancel.textContent = spec.cancelLabel || 'やめる';   // ライティングの決まり：何もせずに閉じるボタンは「やめる」
        cancel.addEventListener('click', function () { finish(null); });
        actions.appendChild(cancel);
      }

      var submit = document.createElement('button');
      // 決定は submit ボタンにし、form の送信を止めて受け取る。
      // type="button" のままだと、入力欄が1つのとき Enter でフォームが送られ、ページが再読み込みされていた
      submit.type = 'submit';
      submit.className = 'c-button' + (spec.danger ? ' c-button--negative' : '');   // 共通部品のボタン。削除などは negative の塗り
      submit.textContent = spec.submit;
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        if (!spec.fields || spec.fields.length === 0) {
          finish(spec.value === undefined ? true : spec.value);
          return;
        }
        var values = {};
        var missing = null;
        spec.fields.forEach(function (field) {
          values[field.name] = inputs[field.name].value.trim();
          if (field.required && values[field.name] === '' && missing === null) {
            missing = field;
          }
        });
        if (missing !== null) {
          showError(missing.name, missing.label + 'を入力してください');
          inputs[missing.name].focus();
          return;
        }
        finish(values);
      });
      actions.appendChild(submit);

      form.appendChild(actions);
      dialog.appendChild(form);
      document.body.appendChild(dialog);

      // Escape で閉じたときも「キャンセル」と同じ扱いにする
      dialog.addEventListener('cancel', function (event) {
        event.preventDefault();
        finish(null);
      });
      // 背景（暗い部分）を押したときも閉じる。
      // dialog 自身に余白があるので、target ではなく位置で「枠の外」かを見る。
      // 押し始めも枠の外のときだけ閉じる（入力欄で文字を選んで枠の外で離したときに閉じない）
      var outside = function (event) {
        var r = dialog.getBoundingClientRect();
        return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom;
      };
      var downOutside = false;
      dialog.addEventListener('pointerdown', function (event) { downOutside = event.target === dialog && outside(event); });
      dialog.addEventListener('click', function (event) {
        if (downOutside && event.target === dialog && outside(event)) { finish(null); }
        downOutside = false;
      });

      dialog.showModal();
      var first = (spec.fields || [])[0];
      if (first) {
        inputs[first.name].focus();
        inputs[first.name].select();
      } else {
        (cancel || submit).focus();   // 共通のモーダルと同じく、最初は取り消せる側（やめる）に置く
      }
    });
  }

  global.OkaDialog = {
    ask: function (spec) { return open(spec); },
    confirm: function (spec) {
      return open({
        title: spec.title,
        message: spec.message,
        submit: spec.submit || '実行する', // ボタンは動詞にする（ライティングの決まり）
        danger: spec.danger === true,
        value: true
      }).then(function (value) { return value === true; });
    },
    notice: function (spec) {
      return open({
        title: spec.title,
        message: spec.message,
        submit: '閉じる',
        cancel: false,
        value: true
      });
    }
  };

  /**
   * `data-confirm` の付いたフォームは、送信前に確認を挟む。
   * 一覧の「削除」で使う。`onsubmit="return confirm(…)"` の置き換え。
   */
  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) { return; }
    var message = form.getAttribute('data-confirm');
    if (!message || form.dataset.okalcConfirmed === '1') { return; }
    // 検証するフォーム（data-validate）で入力に誤りがあるときは、確認より先にエラーを出す
    if (form.hasAttribute('data-validate') && !form.checkValidity()) { return; }

    event.preventDefault();
    var submitter = event.submitter || null;
    global.OkaDialog.confirm({
      title: form.getAttribute('data-confirm-title') || '確認',
      message: message,
      submit: form.getAttribute('data-confirm-ok') || '削除する',
      danger: true
    }).then(function (ok) {
      if (ok) {
        form.dataset.okalcConfirmed = '1';
        // 押したボタンの name / value も送るため requestSubmit を使う（form.submit() は送らない）
        if (form.requestSubmit) { form.requestSubmit(submitter); } else { form.submit(); }
        // 確認済みの印はすぐ外す（戻るボタンでページが復元されたときに、次の削除で確認が飛ばされないように）
        delete form.dataset.okalcConfirmed;
      }
    });
  });
}(window));

/* ---- ドロワー（a-topbar / a-side / a-scrim） ---- */
/**
 * 管理画面のドロワーメニュー（≤980px）。
 *
 * ⚠️ **これが無いとタブレット・スマートフォンでメニューに触れない。**
 * admin.css は ≤980px で `.a-side` を `translateX(-100%)` ＋ `visibility: hidden`
 * にして画面外へ追い出し、`.a-side.is-open` が付いたときだけ戻す。
 * このクラスを付けるのがここ。無いと **≤980px では切り替えもログアウトもできない。**
 *
 * ≥981px ではCSSがドロワーの体裁を打ち消しているため、
 * 開閉クラスが付いていても見た目は変わらない。ただし幅が広がったときに
 * 開いたままだと `.has-drawer` の `overflow: hidden` が残るので、resize で必ず閉じる。
 */
(function () {
  'use strict';

  function setUpDrawer() {
    var shell = document.body;
    var drawer = document.getElementById('a-side');
    var toggle = document.getElementById('drawer-toggle');
    var scrim = document.getElementById('drawer-scrim');
    var closeButton = document.getElementById('drawer-close');
    // ⚠️ id を改名したらここも直す。getElementById が null を返すと何も動かない
    if (!drawer || !toggle || !scrim) { return; }

    // 開いている間は、裏の本文を操作できないようにする（Tab で裏へ移らない。公開サイトのメニューと同じ）
    var setInert = function (on) {
      Array.prototype.forEach.call(shell.children, function (el) {
        if (el === drawer || el === scrim || el.tagName === 'SCRIPT') { return; }
        if (on) { el.setAttribute('inert', ''); } else { el.removeAttribute('inert'); }
      });
    };
    var setDrawer = function (open) {
      setInert(open);
      drawer.classList.toggle('is-open', open);
      shell.classList.toggle('has-drawer', open);
      // ⚠️ scrim は既定で hidden。外さないと ≤980px で常に画面を覆う
      scrim.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
      if (open) {
        // 開いたら最初の項目へ移す。閉じたら開いたボタンへ戻す。
        // ⚠️ **ここで即 focus() しても効かない。** admin.css が visibility を
        //    時間をかけて遷移させるため、この時点ではまだ visibility: hidden で、
        //    見えない要素にフォーカスは入らない。
        //    遷移の完了を待ってから移す。transitionend が来ない環境（動きを減らす
        //    設定など）に備えて、タイマーでも同じ処理を呼ぶ。
        var first = drawer.querySelector('.a-side__link');
        if (first) {
          var moveFocus = function () {
            drawer.removeEventListener('transitionend', moveFocus);
            clearTimeout(focusTimer);
            if (drawer.classList.contains('is-open')) { first.focus(); }
          };
          var focusTimer = setTimeout(moveFocus, 300);
          drawer.addEventListener('transitionend', moveFocus);
        }
      } else if (document.activeElement && drawer.contains(document.activeElement)) {
        toggle.focus();
      }
    };

    toggle.addEventListener('click', function () {
      setDrawer(!drawer.classList.contains('is-open'));
    });
    scrim.addEventListener('click', function () { setDrawer(false); });
    if (closeButton) {
      closeButton.addEventListener('click', function () { setDrawer(false); });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
        setDrawer(false);
      }
    });
    // 980px より広くなったときだけ閉じる。スマホでアドレスバーやキーボードが出入りしても閉じない
    var wide = window.matchMedia('(min-width: 981px)');
    window.addEventListener('resize', function () {
      if (wide.matches && drawer.classList.contains('is-open')) { setDrawer(false); }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setUpDrawer);
  } else {
    setUpDrawer();
  }
})();

/* ---- トースト（OkaToast） ---- */
/**
 * 画面の下中央に浮かせて出す短い知らせ（トースト）。見た目と動きは共通部品の c-toast（js/components.js の OKALC.toast）。
 *
 * 「削除しました。」のような結果表示は、本文の中に置くと**次に何かするまで残り続け**、
 * 見出しや表を押し下げてしまう。画面に重ねて出し、少し経ったら自分で消える形にする。
 *
 * 出し方は2つ。
 *   - サーバー側が `<div class="c-toast-region">` の中に `.c-toast` を書き出しておく（ページを開いた時点で出す）
 *   - `OkaToast.show('文言', { error: true })` で後から出す（OKALC.toast と同じ）
 * アイコンは、ページに <template id="tpl-icon-success"> / <template id="tpl-icon-error"> があればそれを使う
 */
(function (global) {
  'use strict';
  global.OkaToast = {
    show: function (text, options) {
      var type = options && options.error ? 'error' : 'success';
      var tpl = document.getElementById('tpl-icon-' + type);
      return global.OKALC.toast(text, { type: type, icon: tpl ? tpl.innerHTML : '' });
    }
  };
}(window));
