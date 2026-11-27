'use strict';
const net = require('net');

const ALIGN = { y: 1, b: 4, i: 4, u: 4, t: 8, x: 8, s: 4, o: 4, g: 1, a: 4, v: 1, '(': 8 };

class Writer {
  constructor() { this.buf = Buffer.alloc(256); this.pos = 0; }
  grow(n) {
    if (this.pos + n <= this.buf.length) return;
    const next = Buffer.alloc(Math.max(this.buf.length * 2, this.pos + n));
    this.buf.copy(next);
    this.buf = next;
  }
  align(n) { const pad = (n - (this.pos % n)) % n; this.grow(pad); this.buf.fill(0, this.pos, this.pos + pad); this.pos += pad; }
  byte(v) { this.grow(1); this.buf[this.pos++] = v; }
  u32(v) { this.align(4); this.grow(4); this.buf.writeUInt32LE(v >>> 0, this.pos); this.pos += 4; }
  i32(v) { this.align(4); this.grow(4); this.buf.writeInt32LE(v | 0, this.pos); this.pos += 4; }
  u64(v) { this.align(8); this.grow(8); this.buf.writeBigUInt64LE(BigInt(v), this.pos); this.pos += 8; }
  str(v) { const b = Buffer.from(String(v)); this.u32(b.length); this.grow(b.length + 1); b.copy(this.buf, this.pos); this.pos += b.length; this.buf[this.pos++] = 0; }
  sig(v) { const b = Buffer.from(v); this.byte(b.length); this.grow(b.length + 1); b.copy(this.buf, this.pos); this.pos += b.length; this.buf[this.pos++] = 0; }
  value(type, v) {
    switch (type[0]) {
      case 'y': this.byte(v); break;
      case 'b': this.u32(v ? 1 : 0); break;
      case 'i': this.i32(v); break;
      case 'u': this.u32(v); break;
      case 't': this.u64(v); break;
      case 's': case 'o': this.str(v); break;
      case 'g': this.sig(v); break;
      case 'a': {
        const inner = type.slice(1);
        this.u32(0);
        const lenAt = this.pos - 4;
        this.align(ALIGN[inner[0]]);
        const start = this.pos;
        for (const item of v) this.value(inner, item);
        this.buf.writeUInt32LE(this.pos - start, lenAt);
        break;
      }
      default: throw new Error(`dbus: unsupported type ${type}`);
    }
  }
  done() { return this.buf.subarray(0, this.pos); }
}

class Reader {
  constructor(buf, pos = 0) { this.buf = buf; this.pos = pos; }
  align(n) { this.pos += (n - (this.pos % n)) % n; }
  byte() { return this.buf[this.pos++]; }
  u32() { this.align(4); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  i32() { this.align(4); const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  u64() { this.align(8); const v = this.buf.readBigUInt64LE(this.pos); this.pos += 8; return Number(v); }
  str() { const n = this.u32(); const s = this.buf.toString('utf8', this.pos, this.pos + n); this.pos += n + 1; return s; }
  sig() { const n = this.byte(); const s = this.buf.toString('ascii', this.pos, this.pos + n); this.pos += n + 1; return s; }
  value(type) {
    switch (type[0]) {
      case 'y': return this.byte();
      case 'b': return this.u32() !== 0;
      case 'i': return this.i32();
      case 'u': return this.u32();
      case 't': case 'x': return this.u64();
      case 's': case 'o': return this.str();
      case 'g': return this.sig();
      case 'v': return this.value(this.sig());
      default: throw new Error(`dbus: unsupported type ${type}`);
    }
  }
}

function splitSignature(sig) {
  const out = [];
  for (let i = 0; i < sig.length;) {
    let j = i;
    while (sig[j] === 'a') j++;
    out.push(sig.slice(i, j + 1));
    i = j + 1;
  }
  return out;
}

const FIELD = { path: 1, interface: 2, member: 3, error: 4, replySerial: 5, destination: 6, sender: 7, signature: 8 };
const FIELD_TYPE = { 1: 'o', 2: 's', 3: 's', 4: 's', 5: 'u', 6: 's', 7: 's', 8: 'g' };
const FIELD_NAME = Object.fromEntries(Object.entries(FIELD).map(([k, v]) => [v, k]));

function encode(type, serial, fields, signature = '', args = []) {
  const body = new Writer();
  splitSignature(signature).forEach((t, i) => body.value(t, args[i]));
  const bodyBuf = body.done();
  const w = new Writer();
  w.byte(0x6c); w.byte(type); w.byte(0); w.byte(1);
  w.u32(bodyBuf.length); w.u32(serial);
  const all = { ...fields };
  if (signature) all.signature = signature;
  w.u32(0);
  const lenAt = w.pos - 4;
  w.align(8);
  const start = w.pos;
  for (const [name, value] of Object.entries(all)) {
    if (value === undefined) continue;
    const code = FIELD[name];
    w.align(8);
    w.byte(code);
    w.sig(FIELD_TYPE[code]);
    w.value(FIELD_TYPE[code], value);
  }
  w.buf.writeUInt32LE(w.pos - start, lenAt);
  w.align(8);
  return Buffer.concat([w.done(), bodyBuf]);
}

function decode(buf) {
  if (buf.length < 16) return null;
  if (buf[0] !== 0x6c) throw new Error('dbus: big-endian messages are not supported');
  const bodyLen = buf.readUInt32LE(4);
  const fieldsLen = buf.readUInt32LE(12);
  const headerEnd = 16 + fieldsLen + ((8 - ((16 + fieldsLen) % 8)) % 8);
  const total = headerEnd + bodyLen;
  if (buf.length < total) return null;
  const r = new Reader(buf, 16);
  const msg = { type: buf[1], flags: buf[2], serial: buf.readUInt32LE(8), body: [] };
  while (r.pos < 16 + fieldsLen) {
    r.align(8);
    const code = r.byte();
    const value = r.value('v');
    if (FIELD_NAME[code]) msg[FIELD_NAME[code]] = value;
  }
  if (msg.signature) {
    const body = new Reader(buf.subarray(headerEnd, total));
    try { msg.body = splitSignature(msg.signature).map(t => body.value(t)); } catch { msg.body = []; }
  }
  return { msg, size: total };
}

function busPath(address) {
  for (const entry of String(address || '').split(';')) {
    const [transport, params = ''] = entry.split(':');
    if (transport !== 'unix') continue;
    const kv = Object.fromEntries(params.split(',').map(p => p.split('=')).map(([k, v]) => [k, decodeURIComponent(v || '')]));
    if (kv.path) return kv.path;
    if (kv.abstract) return `\0${kv.abstract}`;
  }
  if (process.env.XDG_RUNTIME_DIR) return `${process.env.XDG_RUNTIME_DIR}/bus`;
  return null;
}

class Bus {
  constructor() {
    this.serial = 1;
    this.pending = new Map();
    this.methods = new Map();
    this.signals = [];
  }

  connect() {
    const target = busPath(process.env.DBUS_SESSION_BUS_ADDRESS);
    if (!target) return Promise.reject(new Error('no session bus'));
    return new Promise((resolve, reject) => {
      const sock = net.connect({ path: target });
      this.sock = sock;
      let authed = false;
      let buf = Buffer.alloc(0);
      sock.on('error', err => { if (!authed) reject(err); this.fail(err); });
      sock.on('close', () => this.fail(new Error('dbus connection closed')));
      sock.on('connect', () => {
        const uid = Buffer.from(String(process.getuid())).toString('hex');
        sock.write(Buffer.concat([Buffer.from([0]), Buffer.from(`AUTH EXTERNAL ${uid}\r\n`)]));
      });
      sock.on('data', chunk => {
        buf = Buffer.concat([buf, chunk]);
        if (!authed) {
          const end = buf.indexOf('\r\n');
          if (end < 0) return;
          const line = buf.subarray(0, end).toString();
          buf = buf.subarray(end + 2);
          if (!line.startsWith('OK')) { reject(new Error(`dbus auth failed: ${line}`)); sock.destroy(); return; }
          authed = true;
          sock.write('BEGIN\r\n');
          this.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'Hello')
            .then(([name]) => { this.name = name; resolve(this); }, reject);
        }
        for (;;) {
          let decoded;
          try { decoded = decode(buf); } catch (err) { this.fail(err); sock.destroy(); return; }
          if (!decoded) break;
          buf = buf.subarray(decoded.size);
          this.dispatch(decoded.msg);
        }
      });
    });
  }

  fail(err) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  send(type, fields, signature, args) {
    const serial = this.serial++;
    this.sock.write(encode(type, serial, fields, signature, args));
    return serial;
  }

  call(destination, path, iface, member, signature = '', args = [], timeout = 3000) {
    return new Promise((resolve, reject) => {
      const serial = this.send(1, { path, interface: iface, member, destination }, signature, args);
      const timer = setTimeout(() => { this.pending.delete(serial); reject(new Error(`dbus timeout: ${member}`)); }, timeout);
      this.pending.set(serial, {
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); },
      });
    });
  }

  async own(name) {
    const [result] = await this.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'RequestName', 'su', [name, 4]);
    return result === 1 || result === 4;
  }

  handle(iface, member, fn) { this.methods.set(`${iface}.${member}`, fn); }

  onSignal(match, fn) {
    this.signals.push({ match, fn });
    const rule = Object.entries(match).map(([k, v]) => `${k}='${v}'`).join(',');
    return this.call('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'AddMatch', 's', [`type='signal',${rule}`]);
  }

  dispatch(msg) {
    if (msg.type === 2 || msg.type === 3) {
      const p = this.pending.get(msg.replySerial);
      if (!p) return;
      this.pending.delete(msg.replySerial);
      if (msg.type === 2) p.resolve(msg.body);
      else p.reject(new Error(`${msg.error}: ${msg.body[0] ?? ''}`));
      return;
    }
    if (msg.type === 4) {
      for (const { match, fn } of this.signals) {
        if (Object.entries(match).every(([k, v]) => msg[k] === v)) fn(msg.body, msg);
      }
      return;
    }
    if (msg.type !== 1) return;
    const fn = this.methods.get(`${msg.interface}.${msg.member}`);
    const noReply = msg.flags & 1;
    if (!fn) {
      if (!noReply) this.send(3, { replySerial: msg.serial, destination: msg.sender, error: 'org.freedesktop.DBus.Error.UnknownMethod' }, 's', ['unknown method']);
      return;
    }
    try { fn(...msg.body); } catch {  }
    if (!noReply) this.send(2, { replySerial: msg.serial, destination: msg.sender });
  }

  close() { this.sock?.destroy(); }
}

module.exports = { Bus };
