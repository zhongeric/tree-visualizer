// This file is for static analysis and visualization examples.
// To run the interactive simulator, use `npm run cli`.

import { PackedFenwickTree } from "./packed-fenwick-tree.js";
import { uint64 } from "./types.js";

// Packed Fenwick Tree - 4x64-bit values per 256-bit word

// Constants for bit manipulation
const UINT64_MAX = (1n << 64n) - 1n;
const UINT64_BITS = 64n;

// Visualization of packed Fenwick tree structure
class PackedFenwickVisualizer {
  static visualizeUpdatePath(tick: number, maxTicks: number = 32): void {
    console.log("\nPACKED FENWICK UPDATE VISUALIZATION");
    console.log("=".repeat(60));
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
    console.log("=".repeat(60));
    
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

// Example usage
console.log("PACKED FENWICK TREE IMPLEMENTATION");
console.log("4 × 64-bit values per 256-bit storage slot");
console.log("=".repeat(60));

// Show update visualization
PackedFenwickVisualizer.visualizeUpdatePath(13);

// Show comparison
PackedFenwickVisualizer.compareWithStandard();

// Run growth simulation - This part is now handled by the CLI.
// const simulator = new PackedAuctionSimulator();
// simulator.runFullSimulation();

// Show memory layout
console.log("\n\nMEMORY LAYOUT EXAMPLE");
console.log("=".repeat(60));
console.log("Word 0 contains ticks 0-3:");
console.log("  Slot: 0x[tick3_64bits][tick2_64bits][tick1_64bits][tick0_64bits]");
console.log("  Example: 0x0000000000000064000000000000003200000000000000190000000000000000");
console.log("           = [100, 50, 25, 0] in decimal");

console.log("\nFenwick parent relationships still work:");
console.log("  Tick 5 parent = 5 + (5 & -5) = 6");
console.log("  Both in word 1, positions 1 and 2");
console.log("  Single word read → update both → single word write!");