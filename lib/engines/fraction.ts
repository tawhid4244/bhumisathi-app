// Exact fractions with BigInt, so inheritance shares never suffer floating-point error
// (1/3 stays 1/3; shares always add up to exactly 1).

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

export class Fraction {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n);
    let dd = BigInt(d);
    if (dd === 0n) throw new Error("Fraction with zero denominator");
    if (dd < 0n) [nn, dd] = [-nn, -dd];
    const g = gcd(nn, dd) || 1n;
    this.n = nn / g;
    this.d = dd / g;
  }

  static readonly ZERO = new Fraction(0);
  static readonly ONE = new Fraction(1);

  add(o: Fraction) {
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Fraction) {
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Fraction) {
    return new Fraction(this.n * o.n, this.d * o.d);
  }
  div(o: Fraction) {
    if (o.n === 0n) throw new Error("Division by zero");
    return new Fraction(this.n * o.d, this.d * o.n);
  }
  cmp(o: Fraction) {
    const x = this.n * o.d - o.n * this.d;
    return x === 0n ? 0 : x > 0n ? 1 : -1;
  }
  isZero() {
    return this.n === 0n;
  }
  toNumber() {
    return Number(this.n) / Number(this.d);
  }
  toString() {
    return this.d === 1n ? `${this.n}` : `${this.n}/${this.d}`;
  }
  static sum(list: Fraction[]) {
    return list.reduce((a, b) => a.add(b), Fraction.ZERO);
  }
}

export const frac = (n: number, d = 1) => new Fraction(n, d);
