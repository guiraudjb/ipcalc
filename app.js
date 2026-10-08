/* ipcalc - interface (formulaire, rendu des résultats, PWA). Le calcul est dans ipcalc.js. */
(function () {
  'use strict';

  var C = window.IPCalc;
  var $ = function (id) { return document.getElementById(id); };
  var fields = ['host', 'mask1', 'mask2'];
  var last = null;
  var timer = null;

  /* ---------- Petits utilitaires DOM ---------- */

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'className') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c != null) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function nf(n) {
    return n.toLocaleString('fr-FR');
  }

  function bin(n, prefix, classBits, tag) {
    var node = el(tag || 'span', { className: 'ipc-bin' });
    C.binarySegments(n, prefix, classBits).forEach(function (s) {
      if (s.kind === 'sep' || s.kind === 'dot') node.appendChild(document.createTextNode(s.text));
      else node.appendChild(el('span', { className: 'ipc-bit--' + s.kind, text: s.text }));
    });
    return node;
  }

  /* ---------- Rendu d'un bloc « à la ipcalc » ---------- */

  function row(label, value, binNode, note) {
    var binCell = el('td', { className: 'ipc-col-bin' }, [binNode]);
    return el('tr', {}, [
      el('th', { scope: 'row', text: label }),
      el('td', { className: 'ipc-value', 'data-label': 'Valeur', text: value }),
      binCell,
      el('td', { className: 'ipc-note', 'data-label': 'Remarque' }, note ? [note] : [])
    ]);
  }

  function typeBadge(r) {
    var span = el('span', {});
    span.appendChild(el('span', {
      className: 'fr-badge fr-badge--sm fr-badge--no-icon ipc-badge ' + (r.type.public ? 'fr-badge--info' : 'fr-badge--success'),
      text: r.type.label
    }));
    if (r.type.rfc) span.appendChild(document.createTextNode(r.type.rfc));
    return span;
  }

  function hostsNote(r) {
    if (r.kind === 'hostroute') return 'Route d\'hôte (une seule adresse, pas de broadcast)';
    if (r.kind === 'ptp') return 'Lien point à point, RFC 3021 (pas de broadcast)';
    return null;
  }

  function block(r, opts) {
    var cb = r.cls.bits;
    var p = r.prefix;
    var body = el('tbody');
    if (opts.address) body.appendChild(row('Adresse', C.formatIP(r.address), bin(r.address, p, cb)));
    body.appendChild(row('Masque', C.formatIP(r.mask) + ' = ' + p, bin(r.mask, p, 0)));
    body.appendChild(row('Wildcard', C.formatIP(r.wildcard), bin(r.wildcard, p, 0)));
    body.appendChild(el('tr', { className: 'ipc-arrow', 'aria-hidden': 'true' }, [el('td', { colspan: '4' })]));
    body.appendChild(row('Réseau', C.formatIP(r.network) + '/' + p, bin(r.network, p, cb), 'Classe ' + r.cls.name));
    if (r.broadcast !== null) body.appendChild(row('Broadcast', C.formatIP(r.broadcast), bin(r.broadcast, p, cb)));
    body.appendChild(row('Hôte min', C.formatIP(r.hostMin), bin(r.hostMin, p, cb)));
    body.appendChild(row('Hôte max', C.formatIP(r.hostMax), bin(r.hostMax, p, cb)));
    var note = el('span', {}, [typeBadge(r)]);
    var kn = hostsNote(r);
    if (kn) note.appendChild(el('span', { className: 'fr-hint-text', text: kn }));
    body.appendChild(row('Hôtes/réseau', nf(r.hosts), null, note));

    return el('table', { className: 'ipc-table' }, [
      el('caption', { className: 'fr-sr-only', text: opts.caption }),
      el('thead', {}, [el('tr', {}, [
        el('th', { scope: 'col', text: 'Libellé' }),
        el('th', { scope: 'col', text: 'Valeur' }),
        el('th', { scope: 'col', className: 'ipc-col-bin', text: 'Binaire' }),
        el('th', { scope: 'col', text: 'Remarque' })
      ])]),
      body
    ]);
  }

  function maskTable(prefix, mask, wildcard, caption) {
    return el('table', { className: 'ipc-table fr-mb-3w' }, [
      el('caption', { className: 'fr-sr-only', text: caption }),
      el('tbody', {}, [
        row('Masque', C.formatIP(mask) + ' = ' + prefix, bin(mask, prefix, 0)),
        row('Wildcard', C.formatIP(wildcard), bin(wildcard, prefix, 0))
      ])
    ]);
  }

  function subnetTable(sub) {
    function cell(label, n, prefix) {
      return el('td', { 'data-label': label }, [
        el('span', { className: 'ipc-value', text: n === null ? '-' : C.formatIP(n) + (label === 'Réseau' ? '/' + prefix : '') }),
        n === null ? null : bin(n, prefix, 0)
      ]);
    }
    var body = el('tbody');
    sub.list.forEach(function (n, i) {
      body.appendChild(el('tr', {}, [
        el('th', { scope: 'row', className: 'ipc-num', text: String(i + 1) }),
        cell('Réseau', n.network, n.prefix),
        cell('Hôte min', n.hostMin, n.prefix),
        cell('Hôte max', n.hostMax, n.prefix),
        cell('Broadcast', n.broadcast, n.prefix),
        el('td', { 'data-label': 'Hôtes', className: 'ipc-value', text: nf(n.hosts) })
      ]));
    });
    // Conteneur défilant : sur écran moyen, la liste avec binaire peut dépasser la largeur de la carte.
    return el('div', { className: 'ipc-scroll', tabindex: '0', role: 'region', 'aria-label': 'Liste des sous-réseaux (défilement horizontal possible)' }, [el('table', { className: 'ipc-table ipc-sub' }, [
      el('caption', { className: 'fr-sr-only', text: 'Liste des sous-réseaux' }),
      el('thead', {}, [el('tr', {}, ['N°', 'Réseau', 'Hôte min', 'Hôte max', 'Broadcast', 'Hôtes'].map(function (h) {
        return el('th', { scope: 'col', text: h });
      }))]),
      body
    ])]);
  }

  /* ---------- Formulaire ---------- */

  function values() {
    var v = {};
    fields.forEach(function (f) { v[f] = $(f).value.trim(); });
    return v;
  }

  function showErrors(errors) {
    fields.forEach(function (f) {
      var msg = errors[f];
      $('group-' + f).classList.toggle('fr-input-group--error', !!msg);
      $(f).classList.toggle('fr-input--error', !!msg);
      $(f).setAttribute('aria-invalid', msg ? 'true' : 'false');
      $(f + '-error').hidden = !msg;
      $(f + '-error').textContent = msg || '';
    });
  }

  function showNotices(notices) {
    var box = $('notices');
    box.replaceChildren();
    notices.forEach(function (n) {
      box.appendChild(el('div', { className: 'fr-alert fr-alert--info fr-alert--sm fr-mb-2w' }, [el('p', { text: n })]));
    });
  }

  function updateUrl(v) {
    var params = new URLSearchParams();
    fields.forEach(function (f) { if (v[f]) params.set(f, v[f]); });
    var qs = params.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
  }

  function run(focusResult) {
    var v = values();
    var calc = C.calculate(v);
    showErrors(calc.errors);
    showNotices(calc.notices);

    var ok = calc.ok;
    $('resultat').hidden = !ok;
    $('actions').hidden = !ok;
    $('sous-reseaux').hidden = !(ok && calc.sub);
    $('sur-reseau').hidden = !(ok && calc.supernet);
    if (!ok) {
      last = null;
      $('status').textContent = 'Saisie invalide : corrigez les champs signalés.';
      return;
    }
    last = calc;
    var r = calc.result;

    $('bloc-principal').replaceChildren(block(r, { address: true, caption: 'Résultat du calcul pour ' + C.formatIP(r.address) + '/' + r.prefix }));
    $('btn-prev').disabled = !calc.move.previous;
    $('btn-next').disabled = !calc.move.next;

    if (calc.sub) {
      var s = calc.sub;
      $('titre-sous-reseaux').textContent = 'Sous-réseaux après passage de /' + r.prefix + ' à /' + s.prefix;
      $('bloc-sous-masque').replaceChildren(maskTable(s.prefix, s.mask, s.wildcard, 'Masque des sous-réseaux'));
      $('bloc-sous-reseaux').replaceChildren(subnetTable(s));
      $('sous-resume').textContent = 'Sous-réseaux : ' + nf(s.count) + ' - Hôtes : ' + nf(s.hostsTotal) +
        (s.truncated ? ' (les ' + nf(s.list.length) + ' premiers sont affichés)' : '');
    }
    if (calc.supernet) {
      $('titre-sur-reseau').textContent = 'Sur-réseau /' + calc.supernet.prefix;
      $('bloc-sur-reseau').replaceChildren(block(calc.supernet, { address: false, caption: 'Sur-réseau' }));
    }

    $('status').textContent = 'Réseau ' + C.formatIP(r.network) + '/' + r.prefix + ', ' + nf(r.hosts) +
      ' hôte' + (r.hosts > 1 ? 's' : '') + ', de ' + C.formatIP(r.hostMin) + ' à ' + C.formatIP(r.hostMax) + '.';
    $('copy-status').textContent = '';
    updateUrl(v);
    if (focusResult) {
      $('titre-resultat').setAttribute('tabindex', '-1');
      $('titre-resultat').focus();
    }
  }

  function move(direction) {
    if (!last || !last.move[direction]) return;
    $('host').value = last.move[direction];
    // Conserver le masque effectivement utilisé (y compris le masque de classe par défaut).
    if (!$('mask1').value.trim()) $('mask1').value = String(last.result.prefix);
    run(false);
  }

  function copyText() {
    var text = C.toText(last);
    function done(ok) {
      $('copy-status').textContent = ok ? 'Résultat copié dans le presse-papiers.' : 'Copie impossible : sélectionnez le texte manuellement.';
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      return;
    }
    var ta = el('textarea', { readonly: '', className: 'fr-sr-only' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { done(document.execCommand('copy')); } catch (e) { done(false); }
    ta.remove();
  }

  function fillDatalist() {
    var list = $('masques');
    for (var p = 32; p >= 0; p--) {
      var count = Math.pow(2, 32 - p);
      list.appendChild(el('option', { value: String(p), label: '/' + p + ' - ' + C.formatIP(C.maskFromPrefix(p)) + ' (' + nf(count) + ' adresse' + (count > 1 ? 's' : '') + ')' }));
    }
  }

  function init() {
    fillDatalist();
    $('version').textContent = 'Version ' + C.VERSION + '.';

    var params = new URLSearchParams(location.search);
    var fromUrl = fields.some(function (f) { return params.has(f); });
    $('host').value = fromUrl ? params.get('host') || '' : C.DEFAULT_HOST;
    $('mask1').value = fromUrl ? params.get('mask1') || '' : '24';
    $('mask2').value = fromUrl ? params.get('mask2') || '' : '';

    $('formulaire').addEventListener('submit', function (e) {
      e.preventDefault();
      clearTimeout(timer);
      run(true);
    });
    fields.forEach(function (f) {
      $(f).addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () { run(false); }, 300);
      });
    });
    $('btn-reset').addEventListener('click', function () {
      $('host').value = C.DEFAULT_HOST;
      $('mask1').value = '24';
      $('mask2').value = '';
      run(false);
      $('host').focus();
    });
    $('btn-prev').addEventListener('click', function () { move('previous'); });
    $('btn-next').addEventListener('click', function () { move('next'); });
    $('btn-copy').addEventListener('click', copyText);

    var toggle = $('toggle-bin');
    var stored = null;
    try { stored = localStorage.getItem('ipcalc-binaire'); } catch (e) { /* stockage indisponible */ }
    if (stored === 'non') toggle.checked = false;
    function applyBin() {
      document.body.classList.toggle('ipc-nobin', !toggle.checked);
      try { localStorage.setItem('ipcalc-binaire', toggle.checked ? 'oui' : 'non'); } catch (e) { /* idem */ }
    }
    toggle.addEventListener('change', applyBin);
    applyBin();

    run(false);
  }

  /* ---------- PWA : hors ligne et installation ---------- */

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible */ });
    });
  }

  // Le DSFR recopie les boutons de l'en-tête dans le menu mobile : on cible donc une classe, pas un id.
  var installEvent = null;
  function showInstall(visible) {
    document.querySelectorAll('.ipc-install').forEach(function (b) { b.hidden = !visible; });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    showInstall(true);
  });
  window.addEventListener('appinstalled', function () {
    installEvent = null;
    showInstall(false);
  });
  document.addEventListener('click', function (e) {
    if (!installEvent || !e.target.closest('.ipc-install')) return;
    installEvent.prompt();
    installEvent.userChoice.finally(function () {
      installEvent = null;
      showInstall(false);
    });
  });

  document.addEventListener('DOMContentLoaded', init);
})();
