import { FenwickAuction } from './models/fenwick-auction';
import { FrontierAuction } from './models/frontier-auction';
import { BaseAuction } from './models/base-auction';
import { GasProfiler } from './gas-profiler';
import { Visualizer } from './visualizer';
import { uint256 } from './types';
import inquirer from 'inquirer';
import chalk from 'chalk';

const MAX_TICKS = 10000;

class AuctionSimulator {
  private model: BaseAuction;
  private lastClearingPrice: number = 0;

  constructor(model: BaseAuction) {
    this.model = model;
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
    const result = this.model.bid(bid.tick, bid.amount);

    if (result.summary.type === 'fenwick') {
        Visualizer.showUpdate(result.summary.tick, result.summary.amount, result.summary.opResult, result.gasResult);
        Visualizer.showUpdateInBinary(result.summary.tick, MAX_TICKS);
        const vizData = this.model.getVisualizationData();
        const highlightedWords = result.summary.opResult.operations.map((op: { wordIndex: any; }) => op.wordIndex);
        Visualizer.drawMemoryLayout(vizData.tree, highlightedWords);
        const updatedTicks = result.summary.opResult.operations.map((op: { tick: any; }) => op.tick);
        Visualizer.drawAsciiTree(vizData.tree, updatedTicks);
    } else if (result.summary.type === 'frontier') {
        Visualizer.showFrontierUpdate(result.summary);
        console.log(`   Gas cost for bid & clear: ${chalk.red(result.gasResult.totalGas)}`);
        const vizData = this.model.getVisualizationData();
        Visualizer.drawFrontierState(vizData);
    }
  }

  public async clearFenwickAuction() {
    if (!(this.model instanceof FenwickAuction)) {
        console.log(chalk.red("Clear is only available for the Fenwick Tree model."));
        return;
    }

    const { targetVolumeStr } = await inquirer.prompt({
        type: 'input',
        name: 'targetVolumeStr',
        message: 'Enter target volume to clear:',
        default: '100'
    });
    const targetVolume = BigInt(targetVolumeStr);

    // --- Phase 1: Find Clearing Price (Read-only) ---
    console.log(chalk.bold.blue('\n--- Finding Clearing Price (Search Phase) ---'));
    const { clearingPrice, queryOps } = this.findFenwickClearingPrice(targetVolume);
    const searchGasResult = GasProfiler.calculateQueryCost(queryOps);
    Visualizer.showClear(targetVolume, clearingPrice, queryOps, searchGasResult);

    if (clearingPrice === -1) {
        console.log(chalk.red('Not enough volume in the book to clear this amount.'));
        return;
    }
    this.lastClearingPrice = clearingPrice;

    // --- Phase 2: Update Tree (Write Phase) ---
    console.log(chalk.bold.yellow('\n--- Clearing Filled Ticks from Tree (Write Phase) ---'));
    this.model.beginTx(); // Reset dirty word tracking for this new "transaction"
    
    let remainingVolumeToClear = targetVolume;
    const allUpdateOps: any[] = [];

    // Iterate from the highest possible tick downwards
    for (let tick = MAX_TICKS - 1; tick >= clearingPrice; tick--) {
      if (remainingVolumeToClear <= 0n) break;

      // To get the actual volume at a single tick, we query the range
      const volumeAtTick = this.model.query(tick).sum - this.model.query(tick - 1).sum;

      if (volumeAtTick > 0n) {
        const amountToClearFromTick = remainingVolumeToClear < volumeAtTick ? remainingVolumeToClear : volumeAtTick;
        
        const delta = -amountToClearFromTick;
        const updateResult = this.model.update(tick, delta);
        allUpdateOps.push(...updateResult.operations);

        console.log(`   - Clearing Tick ${tick}, removing ${amountToClearFromTick} volume.`);
        remainingVolumeToClear -= amountToClearFromTick;
      }
    }

    const updateGasResult = GasProfiler.calculateUpdateCost(allUpdateOps);
    console.log(`   Gas cost for writing updates: ${chalk.red(updateGasResult.totalGas)}`);

    console.log(chalk.bold.green('\n--- Tree State After Clearing ---'));
    const vizData = this.model.getVisualizationData();
    Visualizer.drawMemoryLayout(vizData.tree, []);
    Visualizer.drawAsciiTree(vizData.tree, []);
  }

  private findFenwickClearingPrice(targetVolume: uint256): { clearingPrice: number; queryOps: any[] } {
    const fenwickModel = this.model as FenwickAuction;
    let low = 0;
    let high = MAX_TICKS;
    let clearingPrice = 0;
    const allOps: any[] = [];

    const totalVolumeResult = fenwickModel.query(MAX_TICKS - 1);
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

        const volumeBelowResult = fenwickModel.query(mid - 1);
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
    const vizData = this.model.getVisualizationData();
    if(this.model instanceof FenwickAuction) {
        Visualizer.drawMemoryLayout(vizData.tree);
        Visualizer.drawAsciiTree(vizData.tree);
    } else {
        Visualizer.drawFrontierState(vizData);
    }

    while (true) {
      const choices = [{ name: `Place a new random bid`, value: 'bid' }];
      if (this.model instanceof FenwickAuction) {
          choices.push({ name: 'Clear Fenwick auction', value: 'clear' });
      }
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
        await this.clearFenwickAuction();
      } else if (action === 'exit') {
        break;
      }
    }
  }
}

async function main() {
    const { modelType } = await inquirer.prompt({
        type: 'list',
        name: 'modelType',
        message: 'Which auction model would you like to simulate?',
        choices: [
            { name: 'Packed Fenwick Tree', value: 'fenwick' },
            { name: 'Monotone Frontier (Bitmap)', value: 'frontier' },
        ],
    });

    let model: BaseAuction;
    if (modelType === 'fenwick') {
        model = new FenwickAuction(MAX_TICKS);
        console.log(chalk.bold.green('Simulating Packed Fenwick Tree...'));
    } else {
        model = new FrontierAuction(MAX_TICKS);
        console.log(chalk.bold.green('Simulating Monotone Frontier Auction...'));
    }

    const simulator = new AuctionSimulator(model);
    await simulator.run();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
}); 