import { BaseAuction, BidResult } from './base-auction';
import { uint256 } from '../types';
import { GasProfiler } from '../gas-profiler';

const SALE_SUPPLY = 1000n; // Example supply

export class FrontierAuction extends BaseAuction {
    private volume = new Map<number, uint256>();
    private blockBits = new Map<number, uint256>();
    // For simplicity, we'll omit the megabits for now
    
    private Pstar = 0;
    private Vstar = 0n;

    constructor(maxTicks: number) {
        super(maxTicks);
    }
    
    bid(tick: number, amount: uint256): BidResult {
        const gasDetails: any[] = [];
        let totalGas = 0;

        // 1. Update volume
        const oldVolume = this.volume.get(tick) || 0n;
        this.volume.set(tick, oldVolume + amount);
        totalGas += oldVolume === 0n ? 20000 : 5000; // SLOAD + SSTORE
        gasDetails.push({ op: `Update volume at tick ${tick}`, gas: oldVolume === 0n ? 20000 : 5000 });

        // 2. Update Vstar
        this.Vstar += amount;

        // 3. Set bitmap bit
        const blockIndex = tick >> 8;
        const tickInBlock = tick & 255;
        const oldMask = this.blockBits.get(blockIndex) || 0n;
        const newMask = oldMask | (1n << BigInt(tickInBlock));
        if (oldMask !== newMask) {
            this.blockBits.set(blockIndex, newMask);
            totalGas += oldMask === 0n ? 20000 : 5000;
            gasDetails.push({ op: `Set bit for block ${blockIndex}`, gas: oldMask === 0n ? 20000 : 5000 });
        }

        // 4. Clear if oversubscribed
        const clearEvents = [];
        while (this.Vstar > SALE_SUPPLY) {
            const oldPstar = this.Pstar;
            const pstarVolume = this.volume.get(this.Pstar) || 0n;
            
            this.Vstar -= pstarVolume;
            this.volume.delete(this.Pstar);
            totalGas += 5000; // SSTORE for delete
            
            const pstarBlock = this.Pstar >> 8;
            const pstarTickInBlock = this.Pstar & 255;
            const pstarMask = this.blockBits.get(pstarBlock) || 0n;
            this.blockBits.set(pstarBlock, pstarMask & ~(1n << BigInt(pstarTickInBlock)));
            totalGas += 5000; // SSTORE for bitmask update

            const { next, gas: findGas } = this.findNextSetBit(this.Pstar + 1);
            this.Pstar = next;
            totalGas += findGas;
            
            clearEvents.push({ from: oldPstar, to: this.Pstar, gas: 10000 + findGas });
        }

        const summary = {
            type: 'frontier',
            tick,
            amount,
            Pstar: this.Pstar,
            Vstar: this.Vstar,
            clearEvents
        };

        return { gasResult: { totalGas, details: gasDetails.concat(clearEvents.map(e => ({op: `Clear from ${e.from} to ${e.to}`, gas: e.gas}))) }, summary };
    }

    private findNextSetBit(startTick: number): { next: number, gas: number } {
        let gas = 0;
        let blockIndex = startTick >> 8;
        let tickInBlock = startTick & 255;

        while (blockIndex < (this.maxTicks >> 8)) {
            let mask = this.blockBits.get(blockIndex) || 0n;
            gas += 2100; // SLOAD for mask

            // Mask out bits we've already checked
            mask &= (~0n << BigInt(tickInBlock));

            if (mask !== 0n) {
                // Found a bit in this block
                const lsb = mask & -mask; // Isolate the lowest set bit
                const tickOffset = this.countTrailingZeros(lsb);
                return { next: (blockIndex << 8) + tickOffset, gas };
            }

            // Move to the next block
            blockIndex++;
            tickInBlock = 0; // Start scan from the beginning of the next block
        }
        return { next: this.maxTicks, gas }; // No set bit found
    }

    // JS helper for BigInt
    private countTrailingZeros(n: bigint) {
        if (n === 0n) return 0;
        let count = 0;
        while ((n & 1n) === 0n) {
            n >>= 1n;
            count++;
        }
        return count;
    }

    getVisualizationData() {
        return {
            Pstar: this.Pstar,
            Vstar: this.Vstar,
            SaleSupply: SALE_SUPPLY,
            volume: this.volume,
            blockBits: this.blockBits
        };
    }
} 