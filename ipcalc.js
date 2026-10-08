/*
 * ipcalc — moteur de calcul IPv4.
 * Reprend le comportement d'ipcalc de Krischan Jodies (https://jodies.de/ipcalc) :
 * adresse, masque, wildcard, réseau, broadcast, plage d'hôtes, classe, nature de la plage,
 * représentation binaire, sous-réseaux et sur-réseau.
 * Aucune dépendance : utilisable dans le navigateur (window.IPCalc) et sous Node (module.exports).
 */
(function (root) {
  'use strict';

  var VERSION = '1.0.0';
  var TWO32 = 4294967296;
  var DEFAULT_HOST = '192.168.0.1';
  var MAX_SUBNETS_LISTED = 1024;

  /* Plages particulières (de la plus spécifique à la plus large). */
  var SPECIAL_RANGES = [
    ['255.255.255.255', 32, 'Diffusion limitée', 'RFC 919'],
    ['0.0.0.0', 8, 'Ce réseau (« this network »)', 'RFC 1122'],
    ['10.0.0.0', 8, 'Internet privé', 'RFC 1918'],
    ['100.64.0.0', 10, 'Espace partagé (CGNAT)', 'RFC 6598'],
    ['127.0.0.0', 8, 'Boucle locale (loopback)', 'RFC 1122'],
    ['169.254.0.0', 16, 'Lien local (APIPA)', 'RFC 3927'],
    ['172.16.0.0', 12, 'Internet privé', 'RFC 1918'],
    ['192.0.0.0', 24, 'Affectations de protocoles IETF', 'RFC 6890'],
    ['192.0.2.0', 24, 'Documentation (TEST-NET-1)', 'RFC 5737'],
    ['192.88.99.0', 24, 'Relais 6to4 (obsolète)', 'RFC 7526'],
    ['192.168.0.0', 16, 'Internet privé', 'RFC 1918'],
    ['198.18.0.0', 15, 'Tests de performance', 'RFC 2544'],
    ['198.51.100.0', 24, 'Documentation (TEST-NET-2)', 'RFC 5737'],
    ['203.0.113.0', 24, 'Documentation (TEST-NET-3)', 'RFC 5737'],
    ['224.0.0.0', 4, 'Multidiffusion (multicast)', 'RFC 5771'],
    ['240.0.0.0', 4, 'Réservé (usage futur)', 'RFC 1112']
  ];

  /* ---------- Conversions ---------- */

  function parseIP(text) {
    var s = String(text == null ? '' : text).trim();
    if (!/^\d{1,3}(\.\d{1,3}){0,3}$/.test(s)) return null;
    var parts = s.split('.').map(Number);
    if (parts.some(function (o) { return o > 255; })) return null;
    while (parts.length < 4) parts.push(0); // « 10.1 » vaut 10.1.0.0, comme ipcalc
    return ((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3];
  }

  function formatIP(n) {
    return [Math.floor(n / 16777216) % 256, Math.floor(n / 65536) % 256,
      Math.floor(n / 256) % 256, n % 256].join('.');
  }

  function maskFromPrefix(prefix) {
    return prefix === 0 ? 0 : TWO32 - Math.pow(2, 32 - prefix);
  }

  function blockSize(prefix) {
    return Math.pow(2, 32 - prefix);
  }

  function networkOf(ip, prefix) {
    return ip - (ip % blockSize(prefix));
  }

  function toBits(n) {
    var b = n.toString(2);
    return '00000000000000000000000000000000'.slice(b.length) + b;
  }

  /* Préfixe d'un masque contigu (255.255.255.0 → 24), sinon -1. */
  function prefixOfMask(n) {
    var bits = toBits(n);
    return /^1*0*$/.test(bits) ? bits.indexOf('0') === -1 ? 32 : bits.indexOf('0') : -1;
  }

  /*
   * Masque saisi : « 24 », « /24 », « 255.255.255.0 » ou wildcard « 0.0.0.255 ».
   * Retourne { prefix, wildcard } ou null.
   */
  function parseMask(text) {
    var s = String(text == null ? '' : text).trim().replace(/^\//, '');
    if (/^\d{1,2}$/.test(s)) {
      var p = Number(s);
      return p <= 32 ? { prefix: p, wildcard: false } : null;
    }
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return null;
    var n = parseIP(s);
    if (n === null) return null;
    var prefix = prefixOfMask(n);
    if (prefix >= 0) return { prefix: prefix, wildcard: false };
    prefix = prefixOfMask(TWO32 - 1 - n);
    if (prefix >= 0) return { prefix: prefix, wildcard: true };
    return null;
  }

  /* ---------- Classes et plages ---------- */

  function classOf(ip) {
    var first = Math.floor(ip / 16777216);
    if (first < 128) return { name: 'A', bits: 1, defaultPrefix: 8 };
    if (first < 192) return { name: 'B', bits: 2, defaultPrefix: 16 };
    if (first < 224) return { name: 'C', bits: 3, defaultPrefix: 24 };
    if (first < 240) return { name: 'D', bits: 4, defaultPrefix: 32 };
    return { name: 'E', bits: 4, defaultPrefix: 32 };
  }

  function describe(network) {
    for (var i = 0; i < SPECIAL_RANGES.length; i++) {
      var r = SPECIAL_RANGES[i];
      if (networkOf(network, r[1]) === parseIP(r[0])) {
        return { label: r[2], rfc: r[3], public: false };
      }
    }
    return { label: 'Internet public', rfc: '', public: true };
  }

  /* ---------- Calcul d'un réseau ---------- */

  function compute(ip, prefix) {
    var mask = maskFromPrefix(prefix);
    var wildcard = TWO32 - 1 - mask;
    var network = networkOf(ip, prefix);
    var last = network + wildcard;
    var res = {
      address: ip,
      prefix: prefix,
      mask: mask,
      wildcard: wildcard,
      network: network,
      broadcast: last,
      hostMin: network + 1,
      hostMax: last - 1,
      hosts: blockSize(prefix) - 2,
      kind: 'standard',
      cls: classOf(network),
      type: describe(network)
    };
    if (prefix === 32) {
      // Route d'hôte : une seule adresse, pas de broadcast.
      res.kind = 'hostroute';
      res.broadcast = null;
      res.hostMin = res.hostMax = network;
      res.hosts = 1;
    } else if (prefix === 31) {
      // Lien point à point (RFC 3021) : deux hôtes, pas de broadcast.
      res.kind = 'ptp';
      res.broadcast = null;
      res.hostMin = network;
      res.hostMax = last;
      res.hosts = 2;
    }
    return res;
  }

  /* Sous-réseaux de network/prefix découpé en /newPrefix (newPrefix > prefix). */
  function subnets(network, prefix, newPrefix, limit) {
    var max = limit || MAX_SUBNETS_LISTED;
    var count = Math.pow(2, newPrefix - prefix);
    var size = blockSize(newPrefix);
    var list = [];
    for (var i = 0; i < Math.min(count, max); i++) {
      list.push(compute(network + i * size, newPrefix));
    }
    var perNet = compute(network, newPrefix).hosts;
    return { count: count, hostsTotal: count * perNet, list: list, truncated: count > max };
  }

  /* Segments binaires pour l'affichage coloré : bits de classe, réseau, hôte. */
  function binarySegments(n, prefix, classBits) {
    var bits = toBits(n);
    var segs = [];
    function push(kind, text) {
      var lastSeg = segs[segs.length - 1];
      if (lastSeg && lastSeg.kind === kind) lastSeg.text += text;
      else segs.push({ kind: kind, text: text });
    }
    for (var i = 0; i < 32; i++) {
      if (i === prefix && i > 0 && i < 32) push('sep', ' ');
      if (i > 0 && i % 8 === 0) push('dot', '.');
      var kind = i < (classBits || 0) ? 'class' : i < prefix ? 'net' : 'host';
      push(kind, bits[i]);
    }
    return segs;
  }

  function binaryText(n, prefix) {
    return binarySegments(n, prefix, 0).map(function (s) { return s.text; }).join('');
  }

  /* ---------- Point d'entrée : analyse d'un formulaire ---------- */

  /*
   * opts : { host, mask1, mask2 } (chaînes saisies).
   * Retourne { ok, errors:{champ:message}, notices:[], result, sub, supernet, move }.
   */
  function calculate(opts) {
    var out = { ok: false, errors: {}, notices: [], result: null, sub: null, supernet: null, move: null };
    var hostText = String(opts.host || '').trim();
    var mask1Text = String(opts.mask1 || '').trim();
    var mask2Text = String(opts.mask2 || '').trim();

    // « 192.168.0.1/24 » ou « 192.168.0.1 255.255.255.0 » dans le champ adresse.
    var inline = /^([\d.]+)\s*(?:\/|\s)\s*([\d.]+)$/.exec(hostText);
    if (inline) {
      hostText = inline[1];
      if (!mask1Text) mask1Text = inline[2];
    }

    if (!hostText) {
      out.notices.push('Aucune adresse indiquée : ' + DEFAULT_HOST + ' est utilisée.');
      hostText = DEFAULT_HOST;
    }
    var ip = parseIP(hostText);
    if (ip === null) out.errors.host = 'Adresse IPv4 invalide (ex. 192.168.0.1).';

    var m1 = null;
    if (mask1Text) {
      m1 = parseMask(mask1Text);
      if (!m1) out.errors.mask1 = 'Masque invalide : préfixe de 0 à 32, masque contigu ou wildcard.';
      else if (m1.wildcard) out.notices.push('Masque saisi sous forme de wildcard, converti en /' + m1.prefix + '.');
    }

    var m2 = null;
    if (mask2Text) {
      m2 = parseMask(mask2Text);
      if (!m2) out.errors.mask2 = 'Masque invalide : préfixe de 0 à 32, masque contigu ou wildcard.';
    }

    if (Object.keys(out.errors).length) return out;

    var cls = classOf(ip);
    if (!m1) {
      m1 = { prefix: cls.defaultPrefix, wildcard: false };
      out.notices.push('Aucun masque indiqué : masque par défaut de la classe ' + cls.name +
        ' utilisé (/' + cls.defaultPrefix + ').');
    }

    var res = compute(ip, m1.prefix);
    out.result = res;
    out.ok = true;

    if (m2 && m2.prefix > m1.prefix) {
      out.sub = subnets(res.network, m1.prefix, m2.prefix);
      out.sub.prefix = m2.prefix;
      out.sub.mask = maskFromPrefix(m2.prefix);
      out.sub.wildcard = TWO32 - 1 - out.sub.mask;
    } else if (m2 && m2.prefix < m1.prefix) {
      out.supernet = compute(res.network, m2.prefix);
    } else if (m2) {
      out.notices.push('Le second masque est identique au premier : ni sous-réseau ni sur-réseau.');
    }

    // « Se déplacer vers » : réseaux précédent et suivant, même position d'hôte.
    var size = blockSize(m1.prefix);
    var offset = ip - res.network;
    out.move = {
      previous: res.network - size >= 0 ? formatIP(res.network - size + offset) : null,
      next: res.network + size < TWO32 ? formatIP(res.network + size + offset) : null
    };
    return out;
  }

  /* ---------- Export texte (même disposition que la sortie d'ipcalc) ---------- */

  function pad(s, n) {
    s = String(s);
    while (s.length < n) s += ' ';
    return s;
  }

  function line(label, value, bits, note) {
    return pad(label + ':', 13) + pad(value, 22) + (bits || '') + (note ? ' ' + note : '');
  }

  function hostsNote(r) {
    if (r.kind === 'hostroute') return 'route d\'hôte';
    if (r.kind === 'ptp') return 'lien point à point, RFC 3021';
    return '';
  }

  function blockText(r, withAddress) {
    var lines = [];
    if (withAddress) {
      lines.push(line('Adresse', formatIP(r.address), binaryText(r.address, r.prefix)));
    }
    lines.push(line('Masque', formatIP(r.mask) + ' = ' + r.prefix, binaryText(r.mask, r.prefix)));
    lines.push(line('Wildcard', formatIP(r.wildcard), binaryText(r.wildcard, r.prefix)));
    lines.push('=>');
    lines.push(line('Réseau', formatIP(r.network) + '/' + r.prefix, binaryText(r.network, r.prefix),
      '(classe ' + r.cls.name + ')'));
    if (r.broadcast !== null) {
      lines.push(line('Broadcast', formatIP(r.broadcast), binaryText(r.broadcast, r.prefix)));
    }
    lines.push(line('Hôte min', formatIP(r.hostMin), binaryText(r.hostMin, r.prefix)));
    lines.push(line('Hôte max', formatIP(r.hostMax), binaryText(r.hostMax, r.prefix)));
    var note = hostsNote(r);
    lines.push(line('Hôtes/réseau', r.hosts + (note ? ' (' + note + ')' : ''), '',
      '(' + r.type.label + (r.type.rfc ? ', ' + r.type.rfc : '') + ')'));
    return lines.join('\n');
  }

  function toText(calc) {
    if (!calc || !calc.ok) return '';
    var parts = [blockText(calc.result, true)];
    if (calc.sub) {
      var s = calc.sub;
      var head = ['Sous-réseaux après passage de /' + calc.result.prefix + ' à /' + s.prefix,
        line('Masque', formatIP(s.mask) + ' = ' + s.prefix, binaryText(s.mask, s.prefix)),
        line('Wildcard', formatIP(s.wildcard), binaryText(s.wildcard, s.prefix))];
      parts.push(head.join('\n'));
      s.list.forEach(function (n, i) {
        var l = [(i + 1) + '.',
          line('Réseau', formatIP(n.network) + '/' + n.prefix, binaryText(n.network, n.prefix))];
        if (n.broadcast !== null) l.push(line('Broadcast', formatIP(n.broadcast), binaryText(n.broadcast, n.prefix)));
        l.push(line('Hôte min', formatIP(n.hostMin), binaryText(n.hostMin, n.prefix)));
        l.push(line('Hôte max', formatIP(n.hostMax), binaryText(n.hostMax, n.prefix)));
        l.push(line('Hôtes/réseau', n.hosts));
        parts.push(l.join('\n'));
      });
      if (s.truncated) parts.push('(' + s.list.length + ' premiers sous-réseaux affichés sur ' + s.count + ')');
      parts.push('Sous-réseaux : ' + s.count + '\nHôtes :        ' + s.hostsTotal);
    }
    if (calc.supernet) {
      parts.push('Sur-réseau\n' + blockText(calc.supernet, false));
    }
    return parts.join('\n\n') + '\n';
  }

  var api = {
    VERSION: VERSION,
    DEFAULT_HOST: DEFAULT_HOST,
    MAX_SUBNETS_LISTED: MAX_SUBNETS_LISTED,
    parseIP: parseIP,
    formatIP: formatIP,
    parseMask: parseMask,
    maskFromPrefix: maskFromPrefix,
    classOf: classOf,
    describe: describe,
    compute: compute,
    subnets: subnets,
    binarySegments: binarySegments,
    binaryText: binaryText,
    calculate: calculate,
    toText: toText
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.IPCalc = api;
})(typeof self !== 'undefined' ? self : this);
