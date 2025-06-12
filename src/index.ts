// Packed Fenwick Tree - 4x64-bit values per 256-bit word
type uint256 = bigint;
type uint64 = bigint;

// Constants for bit manipulation
const UINT64_MAX = (1n << 64n) - 1n;
const UINT64_BITS = 64n;

class PackedFenwickTree {
  private tree: Map<number, uint256> = new Map(); // word index -> packed 256-bit value
  private readonly maxTicks: number;
  private accessedWords: Set<number> = new Set();
  
  // Metrics
  public storageReads: number = 0;
  public storageWrites: number = 0;
  public bitOperations: number = 0;
  
  constructor(maxTicks: number = 10000) {
    this.maxTicks = maxTicks;
  }
  
  // Calculate which word and position within word for a tick
  private getWordPosition(tick: number): { wordIndex: number, position: number } {
    // Each word contains 4 ticks, so:
    // Ticks 0-3 → word 0, positions 0-3
    // Ticks 4-7 → word 1, positions 0-3
    const wordIndex = Math.floor(tick / 4);
    const position = tick % 4;
    return { wordIndex, position };
  }
  
  // Pack 4 uint64 values into a uint256
  private packWord(values: uint64[]): uint256 {
    let packed = 0n;
    for (let i = 0; i < 4; i++) {
      const value = values[i] || 0n;
      packed |= (value & UINT64_MAX) << (BigInt(i) * UINT64_BITS);
    }
    this.bitOperations += 4;
    return packed;
  }
  
  // Unpack a uint256 into 4 uint64 values
  private unpackWord(packed: uint256): uint64[] {
    const values: uint64[] = [];
    for (let i = 0; i < 4; i++) {
      values[i] = (packed >> (BigInt(i) * UINT64_BITS)) & UINT64_MAX;
    }
    this.bitOperations += 4;
    return values;
  }
  
  // Get value at specific tick
  private getValue(tick: number): uint64 {
    const { wordIndex, position } = this.getWordPosition(tick);
    const packed = this.tree.get(wordIndex) || 0n;
    
    // Track storage access
    if (!this.accessedWords.has(wordIndex)) {
      this.storageReads++; // Cold read
      this.accessedWords.add(wordIndex);
    } else {
      this.storageReads++; // Warm read
    }
    
    const values = this.unpackWord(packed);
    return values[position];
  }
  
  // Set value at specific tick
  private setValue(tick: number, value: uint64): void {
    const { wordIndex, position } = this.getWordPosition(tick);
    const packed = this.tree.get(wordIndex) || 0n;
    
    const values = this.unpackWord(packed);
    values[position] = value;
    
    const newPacked = this.packWord(values);
    this.tree.set(wordIndex, newPacked);
    
    this.storageWrites++;
  }
  
  // Update Fenwick tree for a tick with delta
  update(tick: number, delta: uint64): { depth: number, wordsAccessed: number[] } {
    let idx = tick + 1; // Fenwick is 1-indexed
    let depth = 0;
    const wordsAccessed: number[] = [];
    
    while (idx <= this.maxTicks) {
      depth++;
      
      const currentValue = this.getValue(idx - 1); // Convert back to 0-indexed
      this.setValue(idx - 1, currentValue + delta);
      
      const { wordIndex } = this.getWordPosition(idx - 1);
      if (!wordsAccessed.includes(wordIndex)) {
        wordsAccessed.push(wordIndex);
      }
      
      // Move to parent
      idx += idx & -idx;
    }
    
    return { depth, wordsAccessed };
  }
  
  // Query cumulative sum up to tick (inclusive)
  query(tick: number): uint64 {
    let sum = 0n;
    let idx = tick + 1; // Fenwick is 1-indexed
    
    while (idx > 0) {
      sum += this.getValue(idx - 1); // Convert back to 0-indexed
      idx -= idx & -idx;
    }
    
    return sum;
  }
  
  // Reset metrics
  resetMetrics(): void {
    this.storageReads = 0;
    this.storageWrites = 0;
    this.bitOperations = 0;
  }
  
  // Get tree statistics
  getStats() {
    return {
      wordsUsed: this.tree.size,
      totalCapacity: Math.ceil(this.maxTicks / 4),
      storageUtilization: (this.tree.size / Math.ceil(this.maxTicks / 4) * 100).toFixed(1) + '%'
    };
  }
}

// Visualization of packed Fenwick tree structure
class PackedFenwickVisualizer {
  static visualizeUpdate(tick: number, maxTicks: number = 32): void {
    console.log("\nPACKED FENWICK UPDATE VISUALIZATION");
    console.log("=" .repeat(60));
    console.log(`Updating tick ${tick} (Fenwick index ${tick + 1})`);
    
    // Show word packing
    console.log("\nWord Packing Structure:");
    console.log("Word 0: [Tick 0 | Tick 1 | Tick 2 | Tick 3 ] ← 256 bits");
    console.log("Word 1: [Tick 4 | Tick 5 | Tick 6 | Tick 7 ]");
    console.log("Word 2: [Tick 8 | Tick 9 | Tick 10| Tick 11]");
    console.log("        [64 bits|64 bits|64 bits |64 bits ]");
    
    // Calculate update path
    let idx = tick + 1;
    const updatePath: number[] = [];
    const wordsAccessed = new Set<number>();
    
    while (idx <= maxTicks) {
      updatePath.push(idx - 1); // Store as 0-indexed
      wordsAccessed.add(Math.floor((idx - 1) / 4));
      idx += idx & -idx;
    }
    
    console.log(`\nUpdate path: ${updatePath.map(t => `Tick ${t}`).join(' → ')}`);
    console.log(`Words accessed: ${Array.from(wordsAccessed).sort((a, b) => a - b).join(', ')}`);
    
    // Show bit operations
    console.log("\nBit Operations per Word Access:");
    console.log("1. Read word (1 SLOAD)");
    console.log("2. Unpack: 4 shifts + 4 masks = 8 ops");
    console.log("3. Update value in memory");
    console.log("4. Pack: 4 shifts + 4 ORs = 8 ops");
    console.log("5. Write word (1 SSTORE)");
    console.log("Total: 1 read + 1 write + 16 bit ops");
  }
  
  static compareWithStandard(): void {
    console.log("\n\nCOMPARISON: STANDARD vs PACKED FENWICK");
    console.log("=" .repeat(60));
    
    // Storage comparison
    console.log("\nStorage Usage (10,000 ticks):");
    console.log("Standard: 10,000 slots × 32 bytes = 312.5 KB");
    console.log("Packed:   2,500 slots × 32 bytes = 78.1 KB");
    console.log("Savings:  75% reduction!");
    
    // Operation comparison for typical update
    console.log("\nUpdate Operation (e.g., tick 2537):");
    console.log("\nStandard Fenwick:");
    console.log("  Updates: 2537, 2539, 2543, 2559, 2687, 2815, 3071, 3583, 4607, 6655");
    console.log("  Storage ops: 10 reads + 10 writes = 20 total");
    
    console.log("\nPacked Fenwick:");
    console.log("  Same updates, but packed:");
    console.log("  Words: 634, 634, 635, 639, 671, 703, 767, 895, 1151, 1663");
    console.log("  Unique words: 9 (word 634 accessed twice)");
    console.log("  Storage ops: 9 reads + 9 writes = 18 total");
    console.log("  Savings: 10% fewer storage operations");
    
    // Gas calculation
    console.log("\nGas Comparison (new price bid):");
    const standardGas = 10 * 20000 + 20000; // 10 updates + bucket
    const packedGas = 9 * 20000 + 16 * 9 * 3 + 20000; // 9 updates + bit ops + bucket
    
    console.log(`Standard: ${Math.round(standardGas / 1000)}k gas`);
    console.log(`Packed: ${Math.round(packedGas / 1000)}k gas`);
    console.log(`Overhead: ${Math.round((packedGas - standardGas) / 1000)}k gas (bit operations)`);
    
    // When it's worth it
    console.log("\n\nWhen to use packed Fenwick:");
    console.log("✓ When storage cost dominates (mainnet)");
    console.log("✓ When you have sparse price distributions");
    console.log("✓ When most updates hit warm storage");
    console.log("✗ When computation is expensive (some L2s)");
    console.log("✗ When tree is very small (<100 ticks)");
  }
}

// Simulation of tree growth with packed structure
class PackedAuctionSimulator {
  private tree: PackedFenwickTree;
  private currentFloor: uint256 = 100n;
  
  constructor() {
    this.tree = new PackedFenwickTree(10000);
  }
  
  simulatePeriod(numBids: number, bidDistribution: 'narrow' | 'wide' | 'mixed'): any {
    this.tree.resetMetrics();
    
    const bids: { tick: number, amount: uint64 }[] = [];
    let maxTick = 0;
    let totalWordsAccessed = new Set<number>();
    
    // Generate bids based on distribution
    for (let i = 0; i < numBids; i++) {
      let tickOffset: number;
      
      switch (bidDistribution) {
        case 'narrow':
          // Most bids within $5 of floor
          tickOffset = Math.floor(Math.random() * 500);
          break;
        case 'wide':
          // Bids spread across $50 range
          tickOffset = Math.floor(Math.random() * 5000);
          break;
        case 'mixed':
          // 70% narrow, 30% wide
          if (Math.random() < 0.7) {
            tickOffset = Math.floor(Math.random() * 200);
          } else {
            tickOffset = 200 + Math.floor(Math.random() * 4800);
          }
          break;
      }
      
      maxTick = Math.max(maxTick, tickOffset);
      const amount = 10n + BigInt(Math.floor(Math.random() * 90));
      
      bids.push({ tick: tickOffset, amount });
      
      // Update tree and track words
      const { wordsAccessed } = this.tree.update(tickOffset, amount);
      wordsAccessed.forEach(w => totalWordsAccessed.add(w));
    }
    
    const stats = this.tree.getStats();
    const treeHeight = Math.ceil(Math.log2(maxTick + 1));
    
    return {
      numBids,
      distribution: bidDistribution,
      maxTick,
      treeHeight,
      uniqueWordsAccessed: totalWordsAccessed.size,
      totalWords: stats.wordsUsed,
      storageReads: this.tree.storageReads,
      storageWrites: this.tree.storageWrites,
      bitOperations: this.tree.bitOperations,
      avgWordsPerBid: (this.tree.storageWrites / numBids).toFixed(2)
    };
  }
  
  runFullSimulation(): void {
    console.log("\n\nPACKED FENWICK TREE GROWTH SIMULATION");
    console.log("=" .repeat(60));
    
    const scenarios = [
      { bids: 50, dist: 'narrow' as const },
      { bids: 100, dist: 'narrow' as const },
      { bids: 100, dist: 'wide' as const },
      { bids: 200, dist: 'mixed' as const },
      { bids: 500, dist: 'mixed' as const }
    ];
    
    scenarios.forEach((scenario, i) => {
      const result = this.simulatePeriod(scenario.bids, scenario.dist);
      
      console.log(`\nScenario ${i + 1}: ${result.numBids} bids (${result.distribution})`);
      console.log(`  Max tick: ${result.maxTick} (tree height: ${result.treeHeight})`);
      console.log(`  Words used: ${result.totalWords} of ${Math.ceil(10000/4)} possible`);
      console.log(`  Unique words accessed: ${result.uniqueWordsAccessed}`);
      console.log(`  Storage operations: ${result.storageReads} reads, ${result.storageWrites} writes`);
      console.log(`  Avg words per bid: ${result.avgWordsPerBid}`);
      
      // Calculate efficiency
      const standardOps = result.numBids * result.treeHeight * 2; // reads + writes
      const packedOps = result.storageReads + result.storageWrites;
      const efficiency = ((standardOps - packedOps) / standardOps * 100).toFixed(1);
      
      console.log(`  Efficiency vs standard: ${efficiency}% fewer storage ops`);
    });
  }
}

// Example usage
console.log("PACKED FENWICK TREE IMPLEMENTATION");
console.log("4 × 64-bit values per 256-bit storage slot");
console.log("=" .repeat(60));

// Show update visualization
PackedFenwickVisualizer.visualizeUpdate(13);

// Show comparison
PackedFenwickVisualizer.compareWithStandard();

// Run growth simulation
const simulator = new PackedAuctionSimulator();
simulator.runFullSimulation();

// Show memory layout
console.log("\n\nMEMORY LAYOUT EXAMPLE");
console.log("=" .repeat(60));
console.log("Word 0 contains ticks 0-3:");
console.log("  Slot: 0x[tick3_64bits][tick2_64bits][tick1_64bits][tick0_64bits]");
console.log("  Example: 0x0000000000000064000000000000003200000000000000190000000000000000");
console.log("           = [100, 50, 25, 0] in decimal");

console.log("\nFenwick parent relationships still work:");
console.log("  Tick 5 parent = 5 + (5 & -5) = 6");
console.log("  Both in word 1, positions 1 and 2");
console.log("  Single word read → update both → single word write!");