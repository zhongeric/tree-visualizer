import { PackedFenwickTree } from './packed-fenwick-tree';
import { GasProfiler } from './gas-profiler';
import { Visualizer } from './visualizer';
import { uint256 } from './types';
import inquirer from 'inquirer';

const MAX_TICKS = 10000;

class AuctionSimulator {
  private tree: PackedFenwickTree;
  private bids: { tick: number, amount: uint256 }[] = [];
  private bidCursor = 0;

  constructor() {
    this.tree = new PackedFenwickTree(MAX_TICKS);
    this.generateBids();
  }

  private generateBids() {
    // Generate a mix of dense and sparse bids
    for (let i = 0; i < 20; i++) {
      // Cluster some bids
      const tick = 100 + Math.floor(Math.random() * 20);
      const amount = BigInt(Math.floor(Math.random() * 50) + 1);
      this.bids.push({ tick, amount });
    }
    for (let i = 0; i < 10; i++) {
        // Some sparse bids
        const tick = Math.floor(Math.random() * (MAX_TICKS - 1000)) + 1000;
        const amount = BigInt(Math.floor(Math.random() * 50) + 1);
        this.bids.push({ tick, amount });
    }
    this.bids.sort((a, b) => a.tick - b.tick);
  }

  public hasNextBid(): boolean {
    return this.bidCursor < this.bids.length;
  }

  public placeNextBid() {
    if (!this.hasNextBid()) {
      console.log('No more bids to place.');
      return;
    }
    const bid = this.bids[this.bidCursor];
    this.bidCursor++;

    this.tree.beginTx(); // Reset dirty word tracking for this "transaction"
    const opResult = this.tree.update(bid.tick, bid.amount);
    const gasResult = GasProfiler.calculateUpdateCost(opResult.operations);
    
    Visualizer.showUpdate(bid.tick, bid.amount, opResult, gasResult);
    const highlightedWords = opResult.operations.map(op => op.wordIndex);
    Visualizer.drawTree(this.tree, highlightedWords);
  }

  public async clearAuction() {
    const { targetVolumeStr } = await inquirer.prompt({
        type: 'input',
        name: 'targetVolumeStr',
        message: 'Enter target volume to clear:',
        default: '100'
    });
    const targetVolume = BigInt(targetVolumeStr);

    console.log('Finding clearing price...');
    
    // This is a simplified search. A real implementation would be more robust.
    const { clearingPrice, queryOps } = this.findClearingPrice(targetVolume);
    
    const gasResult = GasProfiler.calculateQueryCost(queryOps);
    Visualizer.showClear(targetVolume, clearingPrice, queryOps, gasResult);
    const highlightedWords = queryOps.map(op => op.wordIndex);
    Visualizer.drawTree(this.tree, highlightedWords);
  }

  // Binary search to find the clearing price
  private findClearingPrice(targetVolume: uint256): { clearingPrice: number; queryOps: any[] } {
    let low = 0;
    let high = MAX_TICKS;
    let clearingPrice = 0;
    let finalOps: any[] = [];

    let totalVolumeResult = this.tree.query(MAX_TICKS -1);
    const totalVolume = totalVolumeResult.sum;

    if (totalVolume < targetVolume) {
        return { clearingPrice: -1, queryOps: [] }; // Not enough volume
    }

    // O(log N) search
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const { sum: volumeAtMid, operations } = this.tree.query(mid);
        
        // We want volumeFromTop, which is totalVolume - volumeBelow
        // fenwickQuery gives sum up to and including mid, so that's volumeBelow
        const volumeFromTop = totalVolume - this.tree.query(mid-1).sum;

        if (volumeFromTop >= targetVolume) {
            // This price or a higher one might be the clearing price
            clearingPrice = mid;
            finalOps = operations;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return { clearingPrice, queryOps: finalOps };
  }

  public run = async () => {
    console.log('--- Packed Fenwick Tree Auction Simulator ---');
    Visualizer.drawTree(this.tree);

    while (true) {
      const choices = [];
      if (this.hasNextBid()) {
        choices.push({ name: `Place next bid (Tick: ${this.bids[this.bidCursor].tick}, Amount: ${this.bids[this.bidCursor].amount})`, value: 'bid' });
      }
      choices.push({ name: 'Clear auction', value: 'clear' });
      choices.push({ name: 'Exit', value: 'exit' });

      const { action } = await inquirer.prompt(
        {
          type: 'list',
          name: 'action',
          message: 'What to do next?',
          choices,
        },
      );

      if (action === 'bid') {
        this.placeNextBid();
      } else if (action === 'clear') {
        await this.clearAuction();
      } else if (action === 'exit') {
        break;
      }
    }
  }
}

async function main() {
  const simulator = new AuctionSimulator();
  await simulator.run();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 