import { randomBytes } from "node:crypto";

// Mock payment gateway — SANDBOX ONLY. No real money ever moves in this prototype, no card or
// wallet number is ever asked for or stored. A real deployment would swap this adapter for the
// government's payment gateway (ekPay / Sonali e-payment) behind an official agreement.

export const PAYMENT_METHODS = ["bkash", "nagad", "rocket", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const METHOD_LABEL: Record<PaymentMethod, { bn: string; en: string }> = {
  bkash: { bn: "বিকাশ (পরীক্ষা)", en: "bKash (test)" },
  nagad: { bn: "নগদ (পরীক্ষা)", en: "Nagad (test)" },
  rocket: { bn: "রকেট (পরীক্ষা)", en: "Rocket (test)" },
  card: { bn: "কার্ড (পরীক্ষা)", en: "Card (test)" },
};

export interface SandboxPayment {
  txn_ref: string;
  amount_taka: number;
  method: PaymentMethod;
  status: "paid";
  sandbox: true;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** A sandbox transaction reference like SBX-7KQ2M9XHPA (no 0/O/1/I to avoid misreading). */
export function sandboxRef(bytes: Buffer = randomBytes(10)): string {
  return `SBX-${[...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

/** "Charge" an amount in the sandbox: always succeeds, returns a receipt reference. */
export function chargeSandbox(amountTaka: number, method: PaymentMethod): SandboxPayment {
  if (!Number.isInteger(amountTaka) || amountTaka <= 0) throw new Error("Invalid amount");
  if (!PAYMENT_METHODS.includes(method)) throw new Error("Invalid method");
  return { txn_ref: sandboxRef(), amount_taka: amountTaka, method, status: "paid", sandbox: true };
}
