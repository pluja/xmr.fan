/* What anyone can see about a transaction from a node, without keys. */

export const UNLOCK_BLOCKS = 10;

export interface TxSummary {
  coinbase: boolean;
  inputs: number;
  outputs: number;
  ringSize?: number;
  /** Piconero. */
  fee: number;
  /** Block height or Unix time before which outputs can't be spent; 0 = none beyond the usual 10 blocks. */
  unlockTime: number;
  version: number;
}

export function txSummary(asJson: unknown): TxSummary | null {
  try {
    const tx = (typeof asJson === "string" ? JSON.parse(asJson) : asJson) as any;
    const coinbase = tx.vin.length === 1 && "gen" in tx.vin[0];
    const firstKey = tx.vin.find((i: any) => i.key)?.key;
    const plainFee = tx.vin.reduce((n: number, i: any) => n + (i.key?.amount ?? 0), 0) - tx.vout.reduce((n: number, o: any) => n + (o.amount ?? 0), 0);
    return {
      coinbase,
      inputs: tx.vin.length,
      outputs: tx.vout.length,
      ringSize: firstKey ? firstKey.key_offsets.length : undefined,
      fee: coinbase ? 0 : tx.rct_signatures?.txnFee ?? Math.max(0, plainFee),
      unlockTime: tx.unlock_time ?? 0,
      version: tx.version,
    };
  } catch {
    return null;
  }
}

export type TxStage = "pool" | "confirming" | "spendable";

export function txStage(inPool: boolean, confirmations: number): TxStage {
  if (inPool) return "pool";
  return confirmations >= UNLOCK_BLOCKS ? "spendable" : "confirming";
}
