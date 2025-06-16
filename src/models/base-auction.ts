import { uint256 } from '../types';

export interface BidResult {
    gasResult: { totalGas: number, details: any[] };
    summary: any;
}

export abstract class BaseAuction {
    protected maxTicks: number;

    constructor(maxTicks: number) {
        this.maxTicks = maxTicks;
    }

    // Abstract method for placing a bid. Each model will implement this differently.
    abstract bid(tick: number, amount: uint256): BidResult;

    // Common method to get the state for visualization.
    // Each model can return a different shape of data.
    abstract getVisualizationData(): any;
} 