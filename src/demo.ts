// Demo to show tree height reduction with increasing clearing price
type uint256 = bigint;

class FenwickTree {
  private tree: Map<number, number> = new Map();
  private maxValue: number;
  private clearingPrice: number = 0;
  
  constructor(maxValue: number) {
    this.maxValue = maxValue;
  }
  
  // Update tree
  update(idx: number, val: number): void {
    if (idx < this.clearingPrice) return;
    
    // Convert to relative position
    let relativeIdx = idx - this.clearingPrice;
    
    while (relativeIdx + this.clearingPrice <= this.maxValue) {
      const current = this.tree.get(relativeIdx) || 0;
      this.tree.set(relativeIdx, current + val);
      
      // Move to parent (add LSB)
      relativeIdx += relativeIdx & -relativeIdx;
      
      // Break if we've exceeded the max price
      if (relativeIdx + this.clearingPrice > this.maxValue) {
        break;
      }
    }
  }
  
  // Get tree height
  getHeight(): number {
    const maxRelativeValue = this.maxValue - this.clearingPrice;
    return Math.floor(Math.log2(maxRelativeValue)) + 1;
  }
  
  // Set new clearing price
  setClearing(newPrice: number): void {
    if (newPrice <= this.clearingPrice) return;
    
    console.log(`Clearing price changed: ${this.clearingPrice} -> ${newPrice}`);
    console.log(`Tree height before: ${this.getHeight()}`);
    
    this.clearingPrice = newPrice;
    
    // Rebuild tree after changing clearing price
    this.tree.clear();
    
    console.log(`Tree height after: ${this.getHeight()}`);
    console.log();
  }
}

// Demo
const MAX_PRICE = 10000;
const tree = new FenwickTree(MAX_PRICE);

console.log(`Starting with clearing price: ${0}`);
console.log(`Max price: ${MAX_PRICE}`);
console.log(`Initial tree height: ${tree.getHeight()}`);
console.log();

// Simulate price increases
tree.setClearing(1000);   // ~10% of range
tree.setClearing(2500);   // 25% of range
tree.setClearing(5000);   // 50% of range
tree.setClearing(9000);   // 90% of range
tree.setClearing(9900);   // 99% of range