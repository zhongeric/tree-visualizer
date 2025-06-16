import { PackedFenwickTree } from '../packed-fenwick-tree';
import { BaseAuction, BidResult } from './base-auction';
import { uint256 } from '../types';
import { GasProfiler } from '../gas-profiler';

export class FenwickAuction extends BaseAuction {
    private tree: PackedFenwickTree;
    
    constructor(maxTicks: number) {
        super(maxTicks);
        this.tree = new PackedFenwickTree(maxTicks);
    }

    bid(tick: number, amount: uint256): BidResult {
        this.tree.beginTx();
        const opResult = this.tree.update(tick, amount);
        const gasResult = GasProfiler.calculateUpdateCost(opResult.operations);
        
        const summary = {
            type: 'fenwick',
            tick,
            amount,
            opResult
        };

        return { gasResult, summary };
    }

    clear(targetVolume: uint256) {
        // This logic will be moved into the CLI for now
        // to handle the two-phase read/write process
    }

    getVisualizationData() {
        return {
            tree: this.tree
        };
    }

    // --- Passthrough methods for the simulator ---
    public query(tick: number) {
        return this.tree.query(tick);
    }
    
    public getActiveTicks() {
        return this.tree.getActiveTicks();
    }

    public beginTx() {
        this.tree.beginTx();
    }

    public update(tick: number, delta: uint256) {
        return this.tree.update(tick, delta);
    }
} 