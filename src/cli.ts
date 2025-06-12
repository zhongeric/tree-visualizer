import { PackedFenwickTree } from './packed-fenwick-tree';
import { GasProfiler } from './gas-profiler';
import { Visualizer } from './visualizer';
import { uint256 } from './types';
import inquirer from 'inquirer';
import chalk from 'chalk';

const MAX_TICKS = 10000;

class AuctionSimulator {
  private tree: PackedFenwickTree;
  private lastClearingPrice: number = 0;

  constructor() {
    this.tree = new PackedFenwickTree(MAX_TICKS);
  }

  private _generateNextBid(): { tick: number, amount: uint256 } {
    // Most bids will be clustered near the last clearing price
    let basePrice = this.lastClearingPrice === 0 ? 100 : this.lastClearingPrice;
    let tick: number;
    
    // Add some variance
    const isAggressive = Math.random() < 0.15; // 15% chance of a high bid
    if (isAggressive) {
        // Aggressive bid, placed somewhere significantly higher
        const offset = Math.floor(Math.random() * 1000) + 50;
        tick = basePrice + offset;
    } else {
        // Standard bid, close to the last clearing price
        const offset = Math.floor(Math.random() * 50);
        tick = basePrice + offset;
    }

    // Ensure tick is within bounds
    tick = Math.min(tick, MAX_TICKS - 1);

    const amount = BigInt(Math.floor(Math.random() * 50) + 1);
    return { tick, amount };
  }

  public placeNextBid() {
    const bid = this._generateNextBid();

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
    this.lastClearingPrice = clearingPrice;

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
      const choices = [
        { name: `Place a new random bid`, value: 'bid' },
        { name: 'Clear auction', value: 'clear' },
        { name: 'Exit', value: 'exit' }
      ];

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