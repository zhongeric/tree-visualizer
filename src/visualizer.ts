import { PackedFenwickTree } from './packed-fenwick-tree.js';
import { uint256 } from './types.js';
import chalk from 'chalk';

export class Visualizer {
  static drawTree(tree: PackedFenwickTree, highlightedWords: number[] = []) {
    console.log(chalk.bold.yellow('\n--- Fenwick Tree State ---'));
    const treeData = tree.getTree();
    if (treeData.size === 0) {
      console.log(chalk.gray('Tree is empty.'));
      return;
    }

    const sortedWords = Array.from(treeData.keys()).sort((a, b) => a - b);
    
    for (const wordIndex of sortedWords) {
      const packedValue = treeData.get(wordIndex)!;
      const values = tree.unpackWord(packedValue);
      
      const isHighlighted = highlightedWords.includes(wordIndex);
      const color = isHighlighted ? chalk.bold.cyan : chalk.white;
      
      const valuesStr = values.map((v, i) => {
        const tick = wordIndex * 4 + i;
        return `T${tick}: ${chalk.green(v.toString())}`;
      }).join(' | ');
      
      console.log(color(`Word ${wordIndex.toString().padStart(3)}: [ ${valuesStr} ]`));
    }
    console.log('--------------------------\n');
  }

  static showUpdate(tick: number, delta: uint256, opResult: any, gasResult: any) {
    console.log(chalk.bold.magenta(`\n=> Update Tick ${tick} with delta ${delta}`));
    console.log(chalk.gray('-----------------------------------------'));

    const wordSet = new Set<number>();
    opResult.operations.forEach((op: { wordIndex: number; }) => wordSet.add(op.wordIndex));

    console.log(`   Words accessed: ${chalk.cyan(Array.from(wordSet).join(', '))}`);
    console.log(`   Gas cost: ${chalk.red(gasResult.totalGas)}`);
    console.log(chalk.gray('   Breakdown:'));
    for(const detail of gasResult.details) {
        console.log(chalk.gray(`     - Tick ${detail.tick} (Word ${detail.wordIndex}): ${detail.gas} gas`));
    }
  }
  
  static showClear(targetVolume: uint256, clearingPrice: number, queryOps: any, gasResult: any) {
    console.log(chalk.bold.blue(`\n=> Clear Auction for volume ${targetVolume}`));
    console.log(chalk.gray('-----------------------------------------'));
    
    const wordSet = new Set<number>();
    queryOps.forEach((op: { wordIndex: number; }) => wordSet.add(op.wordIndex));

    console.log(`   Words accessed during search: ${chalk.cyan(Array.from(wordSet).join(', '))}`);
    console.log(`   Gas cost for search: ${chalk.red(gasResult.totalGas)}`);
    console.log(`   ${chalk.bold.green('Clearing Price Found:')} ${chalk.green.bold(clearingPrice)}`);
  }
} 