import { PackedFenwickTree } from './packed-fenwick-tree.js';
import { uint256 } from './types.js';
import chalk from 'chalk';

export class Visualizer {
  static drawMemoryLayout(tree: PackedFenwickTree, highlightedWords: number[] = []) {
    console.log(chalk.bold.yellow('\n--- Fenwick Memory Layout ---'));
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

  static drawAsciiTree(tree: PackedFenwickTree, highlightedTicks: number[] = []) {
    console.log(chalk.bold.yellow('\n--- Fenwick Tree Structure ---'));
    const activeNodes = tree.getActiveTicks();
    if (activeNodes.length === 0) {
      console.log(chalk.gray('Tree is empty.'));
      return;
    }

    const maxTick = tree['maxTicks'];
    const parentToChildren = new Map<number, number[]>();
    const allTicks = new Set<number>();
    const allChildren = new Set<number>();

    for (const { tick } of activeNodes) {
        allTicks.add(tick);
        const idx = tick + 1;
        const parentIdx = idx + (idx & -idx);
        if (parentIdx <= maxTick) {
            const parentTick = parentIdx - 1;
            if (!parentToChildren.has(parentTick)) {
                parentToChildren.set(parentTick, []);
            }
            parentToChildren.get(parentTick)!.push(tick);
            allChildren.add(tick);
            allTicks.add(parentTick);
        }
    }

    const roots = Array.from(allTicks).filter(t => !allChildren.has(t)).sort((a,b) => b-a);

    const printNode = (tick: number, prefix: string, isLast: boolean) => {
        const value = tree.peekValue(tick);
        const connector = isLast ? '└──' : '├──';
        const color = highlightedTicks.includes(tick) ? chalk.bold.magenta : chalk.white;
        console.log(prefix + color(`${connector} T${tick} (Value: ${value})`));
        
        const children = (parentToChildren.get(tick) || []).sort((a,b) => b-a);
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        children.forEach((child, index) => {
            printNode(child, newPrefix, index === children.length - 1);
        });
    };
    
    roots.forEach(root => {
      const value = tree.peekValue(root);
      console.log(chalk.bold(`T${root} (Value: ${value})`));
      const children = (parentToChildren.get(root) || []).sort((a,b) => b-a);
      children.forEach((child, index) => {
          printNode(child, '', index === children.length - 1);
      });
    });

    console.log('----------------------------\n');
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

    console.log(`   Words accessed during search: ${chalk.cyan(Array.from(wordSet).sort((a,b)=>a-b).join(', '))}`);
    console.log(`   Gas cost for search: ${chalk.red(gasResult.totalGas)}`);
    if (clearingPrice !== -1) {
      console.log(`   ${chalk.bold.green('Clearing Price Found:')} ${chalk.green.bold(clearingPrice)}`);
    }
  }

  static showUpdateInBinary(tick: number, maxTicks: number) {
    console.log(chalk.bold.yellow('\n--- Update Path in Binary ---'));
    let idx = tick + 1;
    const binaryLength = (maxTicks).toString(2).length;

    console.log(
        chalk.underline('Index (Dec)'.padEnd(12)) +
        chalk.underline('Index (Bin)'.padEnd(binaryLength + 4)) +
        chalk.underline('LSB (Bin)'.padEnd(binaryLength + 4)) +
        chalk.underline('Parent Index')
    );

    while (idx <= maxTicks) {
        const lsb = idx & -idx;
        const parentIdx = idx + lsb;

        console.log(
            idx.toString().padEnd(12) +
            chalk.cyan(idx.toString(2).padStart(binaryLength, '0')) + '    ' +
            chalk.magenta(lsb.toString(2).padStart(binaryLength, '0')) + '    ' +
            (parentIdx <= maxTicks ? parentIdx.toString() : '-> out of bounds')
        );
        idx = parentIdx;
    }
    console.log('---------------------------\n');
  }
} 