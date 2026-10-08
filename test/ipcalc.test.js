// Tests du moteur : node --test test/*.test.js
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../ipcalc.js');

const ip = C.formatIP;

test('exemple de la page jodies.de : 192.168.0.1/24', () => {
  const c = C.calculate({ host: '192.168.0.1', mask1: '24' });
  assert.ok(c.ok);
  const r = c.result;
  assert.equal(ip(r.mask), '255.255.255.0');
  assert.equal(ip(r.wildcard), '0.0.0.255');
  assert.equal(ip(r.network), '192.168.0.0');
  assert.equal(ip(r.broadcast), '192.168.0.255');
  assert.equal(ip(r.hostMin), '192.168.0.1');
  assert.equal(ip(r.hostMax), '192.168.0.254');
  assert.equal(r.hosts, 254);
  assert.equal(r.cls.name, 'C');
  assert.equal(r.type.label, 'Internet privé');
  assert.equal(C.binaryText(r.address, 24), '11000000.10101000.00000000 .00000001');
  assert.equal(C.binaryText(r.mask, 24), '11111111.11111111.11111111 .00000000');
});

test('masque par défaut de la classe et adresse par défaut', () => {
  const c = C.calculate({ host: '', mask1: '' });
  assert.equal(c.result.prefix, 24);
  assert.equal(c.notices.length, 2);
  assert.equal(C.calculate({ host: '10.1.2.3' }).result.prefix, 8);
  assert.equal(C.calculate({ host: '172.20.1.1' }).result.prefix, 16);
});

test('formes de masque : préfixe, /préfixe, pointé, wildcard', () => {
  for (const m of ['26', '/26', '255.255.255.192', '0.0.0.63']) {
    assert.equal(C.calculate({ host: '10.0.0.77', mask1: m }).result.prefix, 26, m);
  }
  assert.equal(C.parseMask('0.0.0.63').wildcard, true);
  assert.equal(C.parseMask('255.0.255.0'), null);
  assert.equal(C.parseMask('33'), null);
  assert.equal(C.parseMask('0.0.0.0').prefix, 0);
});

test('masque dans le champ adresse', () => {
  assert.equal(C.calculate({ host: '10.0.0.1/30' }).result.prefix, 30);
  assert.equal(C.calculate({ host: '10.0.0.1 255.255.255.252' }).result.prefix, 30);
});

test('erreurs de saisie', () => {
  const c = C.calculate({ host: '300.1.1.1', mask1: 'abc', mask2: '40' });
  assert.equal(c.ok, false);
  assert.deepEqual(Object.keys(c.errors).sort(), ['host', 'mask1', 'mask2']);
});

test('/31 point à point et /32 route d\'hôte', () => {
  const p = C.compute(C.parseIP('10.0.0.1'), 31);
  assert.equal(p.kind, 'ptp');
  assert.equal(p.hosts, 2);
  assert.equal(p.broadcast, null);
  assert.equal(ip(p.hostMin), '10.0.0.0');
  assert.equal(ip(p.hostMax), '10.0.0.1');
  const h = C.compute(C.parseIP('10.0.0.1'), 32);
  assert.equal(h.kind, 'hostroute');
  assert.equal(h.hosts, 1);
});

test('/0 et extrémités de l\'espace', () => {
  const r = C.compute(C.parseIP('8.8.8.8'), 0);
  assert.equal(ip(r.network), '0.0.0.0');
  assert.equal(ip(r.broadcast), '255.255.255.255');
  assert.equal(r.hosts, 4294967294);
  const c = C.calculate({ host: '255.255.255.1', mask1: '24' });
  assert.equal(c.move.next, null);
  assert.equal(c.move.previous, '255.255.254.1');
  assert.equal(C.calculate({ host: '0.0.0.5', mask1: '24' }).move.previous, null);
});

test('sous-réseaux /24 → /26', () => {
  const c = C.calculate({ host: '192.168.0.1', mask1: '24', mask2: '26' });
  assert.equal(c.sub.count, 4);
  assert.equal(c.sub.hostsTotal, 248);
  assert.deepEqual(c.sub.list.map(n => ip(n.network)), ['192.168.0.0', '192.168.0.64', '192.168.0.128', '192.168.0.192']);
  assert.equal(ip(c.sub.list[3].broadcast), '192.168.0.255');
});

test('sous-réseaux tronqués au-delà de la limite', () => {
  const c = C.calculate({ host: '10.0.0.0', mask1: '8', mask2: '24' });
  assert.equal(c.sub.count, 65536);
  assert.equal(c.sub.list.length, C.MAX_SUBNETS_LISTED);
  assert.ok(c.sub.truncated);
});

test('sur-réseau /24 → /22', () => {
  const c = C.calculate({ host: '192.168.5.10', mask1: '24', mask2: '22' });
  assert.equal(ip(c.supernet.network), '192.168.4.0');
  assert.equal(ip(c.supernet.broadcast), '192.168.7.255');
  assert.equal(c.supernet.hosts, 1022);
});

test('nature des plages', () => {
  const d = s => C.describe(C.parseIP(s)).label;
  assert.equal(d('8.8.8.0'), 'Internet public');
  assert.equal(d('127.0.0.0'), 'Boucle locale (loopback)');
  assert.equal(d('169.254.1.0'), 'Lien local (APIPA)');
  assert.equal(d('100.64.0.0'), 'Espace partagé (CGNAT)');
  assert.equal(d('172.31.0.0'), 'Internet privé');
  assert.equal(d('172.32.0.0'), 'Internet public');
  assert.equal(d('224.0.0.1'), 'Multidiffusion (multicast)');
  assert.equal(d('255.255.255.255'), 'Diffusion limitée');
  assert.equal(d('250.0.0.0'), 'Réservé (usage futur)');
});

test('déplacement : réseau précédent et suivant, même position d\'hôte', () => {
  const c = C.calculate({ host: '192.168.0.10', mask1: '24' });
  assert.equal(c.move.previous, '192.167.255.10');
  assert.equal(c.move.next, '192.168.1.10');
});

test('segments binaires colorés', () => {
  const segs = C.binarySegments(C.parseIP('192.168.0.1'), 24, 3);
  assert.equal(segs[0].kind, 'class');
  assert.equal(segs[0].text, '110');
  assert.equal(segs.map(s => s.text).join(''), '11000000.10101000.00000000 .00000001');
});

test('export texte', () => {
  const t = C.toText(C.calculate({ host: '192.168.0.1', mask1: '24', mask2: '25' }));
  assert.match(t, /Réseau:\s+192\.168\.0\.0\/24/);
  assert.match(t, /Sous-réseaux : 2/);
});
