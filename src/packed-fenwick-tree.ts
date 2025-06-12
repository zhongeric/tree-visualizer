import { uint256, uint64 } from "./types.js";

// Constants for bit manipulation
const UINT64_MAX = (1n << 64n) - 1n;
const UINT64_BITS = 64n;

export class PackedFenwickTree {
  private tree: Map<number, uint256> = new Map(); // word index -> packed 256-bit value
  private readonly maxTicks: number;
  private accessedWords: Set<number> = new Set();
  private dirtyWords: Set<number> = new Set(); // For tracking writes
  
  constructor(maxTicks: number) {
    this.maxTicks = maxTicks;
  }
  
  // Calculate which word and position within word for a tick
  getWordPosition(tick: number): { wordIndex: number, position: number } {
    const wordIndex = Math.floor(tick / 4);
    const position = tick % 4;
    return { wordIndex, position };
  }
  
  // Pack 4 uint64 values into a uint256
  packWord(values: uint64[]): uint256 {
    let packed = 0n;
    for (let i = 0; i < 4; i++) {
      const value = values[i] || 0n;
      packed |= (value & UINT64_MAX) << (BigInt(i) * UINT64_BITS);
    }
    return packed;
  }
  
  // Unpack a uint256 into 4 uint64 values
  unpackWord(packed: uint256): uint64[] {
    const values: uint64[] = [];
    for (let i = 0; i < 4; i++) {
      values[i] = (packed >> (BigInt(i) * UINT64_BITS)) & UINT64_MAX;
    }
    return values;
  }
  
  // Get value at specific tick
  getValue(tick: number): { value: uint64, wordIndex: number, isCold: boolean } {
    const { wordIndex, position } = this.getWordPosition(tick);
    const packed = this.tree.get(wordIndex) || 0n;
    
    const isCold = !this.accessedWords.has(wordIndex);
    this.accessedWords.add(wordIndex);
    
    const values = this.unpackWord(packed);
    return { value: values[position], wordIndex, isCold };
  }
  
  // Set value at specific tick
  setValue(tick: number, value: uint64): { wordIndex: number, isCold: boolean } {
    const { wordIndex, position } = this.getWordPosition(tick);
    const packed = this.tree.get(wordIndex) || 0n;
    
    const values = this.unpackWord(packed);
    values[position] = value;
    
    const newPacked = this.packWord(values);
    this.tree.set(wordIndex, newPacked);
    
    const isCold = !this.dirtyWords.has(wordIndex);
    this.dirtyWords.add(wordIndex);
    
    return { wordIndex, isCold };
  }
  
  // Update Fenwick tree for a tick with delta
  update(tick: number, delta: uint64): { operations: any[] } {
    let idx = tick + 1; // Fenwick is 1-indexed
    const operations: any[] = [];
    
    while (idx <= this.maxTicks) {
      const op: { tick: number; wordIndex: number; reads: { wordIndex: number; isCold: boolean }[]; writes: { wordIndex: number; isCold: boolean }[] } = { tick: idx - 1, wordIndex: 0, reads: [], writes: [] };
      
      const { value, wordIndex, isCold: isReadCold } = this.getValue(idx - 1); // Convert back to 0-indexed
      op.reads.push({ wordIndex, isCold: isReadCold });
      
      const { isCold: isWriteCold } = this.setValue(idx - 1, value + delta);
      op.writes.push({ wordIndex, isCold: isWriteCold });
      op.wordIndex = wordIndex;
      
      operations.push(op);
      
      // Move to parent
      idx += idx & -idx;
    }
    
    return { operations };
  }
  
  // Query cumulative sum up to tick (inclusive)
  query(tick: number): { sum: uint64, operations: any[] } {
    let sum = 0n;
    let idx = tick + 1; // Fenwick is 1-indexed
    const operations: any[] = [];
    
    while (idx > 0) {
      const { value, wordIndex, isCold } = this.getValue(idx - 1); // Convert back to 0-indexed
      sum += value;
      operations.push({ tick: idx - 1, wordIndex, isCold });
      idx -= idx & -idx;
    }
    
    return { sum, operations };
  }

  getTree() {
    return this.tree;
  }
  
  // Reset dirty words tracking for a new transaction
  beginTx(): void {
    this.dirtyWords.clear();
  }
} 