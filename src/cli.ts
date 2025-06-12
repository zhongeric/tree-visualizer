import { PackedFenwickTree } from './packed-fenwick-tree';
import { GasProfiler } from './gas-profiler';
import { Visualizer } from './visualizer';
import { uint256 } from './types';
import inquirer from 'inquirer';
import chalk from 'chalk';

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
    Visualizer.showUpdateInBinary(bid.tick, MAX_TICKS);
    const highlightedWords = opResult.operations.map((op: { wordIndex: any; }) => op.wordIndex);
    Visualizer.drawMemoryLayout(this.tree, highlightedWords);

    const updatedTicks = opResult.operations.map((op: { tick: any; }) => op.tick);
    Visualizer.drawAsciiTree(this.tree, updatedTicks);
  }

  public async clearAuction() {
    const { targetVolumeStr } = await inquirer.prompt({
        type: 'input',
        name: 'targetVolumeStr',
        message: 'Enter target volume to clear:',
        default: '100'
    });
    const targetVolume = BigInt(targetVolumeStr);

    // --- Phase 1: Find Clearing Price (Read-only) ---
    console.log(chalk.bold.blue('\n--- Finding Clearing Price (Search Phase) ---'));
    const { clearingPrice, queryOps } = this.findClearingPrice(targetVolume);
    const searchGasResult = GasProfiler.calculateQueryCost(queryOps);
    Visualizer.showClear(targetVolume, clearingPrice, queryOps, searchGasResult);

    if (clearingPrice === -1) {
        console.log(chalk.red('Not enough volume in the book to clear this amount.'));
        return;
    }

    // --- Phase 2: Update Tree (Write Phase) ---
    console.log(chalk.bold.yellow('\n--- Clearing Filled Ticks from Tree (Write Phase) ---'));
    this.tree.beginTx(); // Reset dirty word tracking for this new "transaction"
    
    let remainingVolumeToClear = targetVolume;
    const allUpdateOps: any[] = [];

    // Iterate from the highest possible tick downwards
    for (let tick = MAX_TICKS - 1; tick >= clearingPrice; tick--) {
      if (remainingVolumeToClear <= 0n) break;

      // To get the actual volume at a single tick, we query the range
      const volumeAtTick = this.tree.query(tick).sum - this.tree.query(tick - 1).sum;

      if (volumeAtTick > 0n) {
        const amountToClearFromTick = remainingVolumeToClear < volumeAtTick ? remainingVolumeToClear : volumeAtTick;
        
        const delta = -amountToClearFromTick;
        const updateResult = this.tree.update(tick, delta);
        allUpdateOps.push(...updateResult.operations);

        console.log(`   - Clearing Tick ${tick}, removing ${amountToClearFromTick} volume.`);
        remainingVolumeToClear -= amountToClearFromTick;
      }
    }

    const updateGasResult = GasProfiler.calculateUpdateCost(allUpdateOps);
    console.log(`   Gas cost for writing updates: ${chalk.red(updateGasResult.totalGas)}`);

    console.log(chalk.bold.green('\n--- Tree State After Clearing ---'));
    Visualizer.drawMemoryLayout(this.tree, []);
    Visualizer.drawAsciiTree(this.tree, []);
  }

  // Binary search to find the clearing price
  private findClearingPrice(targetVolume: uint256): { clearingPrice: number; queryOps: any[] } {
    let low = 0;
    let high = MAX_TICKS;
    let clearingPrice = 0;
    const allOps: any[] = [];

    const totalVolumeResult = this.tree.query(MAX_TICKS - 1);
    const totalVolume = totalVolumeResult.sum;
    allOps.push(...totalVolumeResult.operations);

    if (totalVolume < targetVolume) {
        return { clearingPrice: -1, queryOps: [] }; // Not enough volume
    }

    // O(log N) search
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        
        if (mid === 0) {
            low = mid + 1;
            continue;
        }

        const volumeBelowResult = this.tree.query(mid - 1);
        allOps.push(...volumeBelowResult.operations);
        
        const volumeFromTop = totalVolume - volumeBelowResult.sum;

        if (volumeFromTop >= targetVolume) {
            // This price or a higher one might be the clearing price
            clearingPrice = mid;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return { clearingPrice, queryOps: allOps };
  }

  public run = async () => {
    console.log('--- Packed Fenwick Tree Auction Simulator ---');
    Visualizer.drawMemoryLayout(this.tree);
    Visualizer.drawAsciiTree(this.tree);

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