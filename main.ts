// tiny-stack-vm: an exact interpreter of make.fun's tiny stack ISA v1.
// Every rule of ISA.md in its stated order: 32-bit wrapping, the unsigned
// family, shift masking, sign-extended PUSH8, and all ten traps with the
// output written before the trap kept.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SM = 256, CM = 64, MM = 256, SL = 1e6, OL = 65536;
// immediate bytes, pops, pushes for every opcode
const IMM = new Uint8Array(256), POP = new Uint8Array(256), PSH = new Uint8Array(256), OK = new Uint8Array(256);
const def = (o: number, i = 0, p = 0, u = 0) => { IMM[o] = i; POP[o] = p; PSH[o] = u; OK[o] = 1; };
for (const o of [0x00, 0x03, 0x04, 0x05, 0x06, 0x07, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x20, 0x21, 0x22, 0x34, 0x40, 0x41, 0x50, 0x51, 0x52, 0x53]) def(o);
def(0x01, 1, 0, 1); def(0x02, 4, 0, 1);
def(0x30, 2); def(0x31, 2, 1); def(0x32, 2, 1); def(0x33, 2);
POP[0x03] = 1; PSH[0x04] = 2; POP[0x04] = 1;
POP[0x05] = 2; PSH[0x05] = 2;
POP[0x06] = 2; PSH[0x06] = 3;
POP[0x07] = 3; PSH[0x07] = 3;
for (const o of [0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x18, 0x19, 0x1a, 0x1c, 0x1d, 0x1e, 0x20, 0x21, 0x22]) { POP[o] = 2; PSH[o] = 1; }
POP[0x17] = 1; PSH[0x17] = 1;
POP[0x1b] = 1; PSH[0x1b] = 1;
POP[0x31] = 1; POP[0x32] = 1;
POP[0x40] = 1; PSH[0x40] = 1;
POP[0x41] = 2;
POP[0x50] = 1; POP[0x51] = 1; PSH[0x52] = 1; POP[0x53] = 1;

function run(P: Uint8Array, IN: Uint8Array): { o: Uint8Array; e: number } {
  const n = P.length, D = new Int32Array(SM), C = new Int32Array(CM), M = new Int32Array(MM);
  let sp = 0, cp = 0, ip = 0, pc = 0, st = 0;
  const O = new Uint8Array(OL), T = new Uint8Array(10);
  let ol = 0;
  const done = (e: number) => ({ o: O.slice(0, ol), e });
  for (;;) {
    if (st === SL) return done(10);
    if (pc < 0 || pc >= n) return done(9);
    const op = P[pc];
    if (!OK[op]) return done(5);
    const im = IMM[op];
    if (pc + im >= n) return done(9);
    st++;
    const nx = pc + 1 + im;
    const po = POP[op], ps = PSH[op];
    if (sp < po) return done(2);
    if (sp - po + ps > SM) return done(3);
    pc = nx;
    switch (op) {
      case 0x00: return done(0);
      case 0x01: D[sp++] = (P[nx - 1] << 24) >> 24; break;
      case 0x02: D[sp++] = P[nx - 4] | (P[nx - 3] << 8) | (P[nx - 2] << 16) | (P[nx - 1] << 24); break;
      case 0x03: sp--; break;
      case 0x04: D[sp] = D[sp - 1]; sp++; break;
      case 0x05: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 0x06: D[sp] = D[sp - 2]; sp++; break;
      case 0x07: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 0x17: D[sp - 1] = -D[sp - 1] | 0; break;
      case 0x1b: D[sp - 1] = ~D[sp - 1]; break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e:
      case 0x20: case 0x21: case 0x22: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        if (op === 0x10) r = (a + b) | 0;
        else if (op === 0x11) r = (a - b) | 0;
        else if (op === 0x12) r = Math.imul(a, b);
        else if (op === 0x13) { if (b === 0) return done(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 0x14) { if (b === 0) return done(4); r = b === -1 ? 0 : a % b | 0; }
        else if (op === 0x15) { if (b === 0) return done(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 0x16) { if (b === 0) return done(4); r = (a >>> 0) % (b >>> 0) | 0; }
        else if (op === 0x18) r = a & b;
        else if (op === 0x19) r = a | b;
        else if (op === 0x1a) r = a ^ b;
        else if (op === 0x1c) r = a << (b & 31);
        else if (op === 0x1d) r = a >> (b & 31);
        else if (op === 0x1e) r = (a >>> (b & 31)) | 0;
        else if (op === 0x20) r = a === b ? 1 : 0;
        else if (op === 0x21) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        sp -= 2; D[sp++] = r;
        break;
      }
      case 0x30: case 0x31: case 0x32: {
        const rel = ((P[nx - 2] | (P[nx - 1] << 8)) << 16) >> 16;
        let t = true;
        if (op !== 0x30) { const v = D[--sp]; t = op === 0x31 ? v === 0 : v !== 0; }
        if (t) pc = nx + rel;
        break;
      }
      case 0x33:
        if (cp === CM) return done(7);
        C[cp++] = nx;
        pc = P[nx - 2] | (P[nx - 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return done(8);
        pc = C[--cp];
        break;
      case 0x40: { const a = D[sp - 1]; if (a < 0 || a >= MM) return done(6); D[sp - 1] = M[a]; break; }
      case 0x41: { const a = D[sp - 1], v = D[sp - 2]; if (a < 0 || a >= MM) return done(6); sp -= 2; M[a] = v; break; }
      case 0x50: {
        // PRINT writes v in decimal ASCII: a leading '-' when negative, no padding, no newline.
        // Writes into a scratch buffer first, so a value that would pass the limit writes none of its bytes.
        let v = D[sp - 1], L = 0, neg = false;
        if (v < 0) { neg = true; v = -v; }
        do { T[L++] = v % 10; v = (v - (v % 10)) / 10; } while (v !== 0);
        const len = L + (neg ? 1 : 0);
        if (ol + len > OL) return done(11);
        sp--;
        if (neg) O[ol++] = 45;
        while (L > 0) O[ol++] = 48 + T[--L];
        break;
      }
      case 0x51: if (ol + 1 > OL) return done(11); O[ol++] = D[--sp] & 255; break;
      case 0x52: D[sp++] = ip < IN.length ? IN[ip++] : -1; break;
      case 0x53: return done(D[--sp] & 255);
    }
  }
}

const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OU = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const r = run(new Uint8Array(readFileSync(join(I, id, 'program.bin'))), new Uint8Array(readFileSync(join(I, id, 'input.bin'))));
  mkdirSync(join(OU, id), { recursive: true });
  writeFileSync(join(OU, id, 'stdout.bin'), r.o);
  writeFileSync(join(OU, id, 'exit.txt'), `${r.e}\n`);
}
