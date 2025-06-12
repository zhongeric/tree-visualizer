export class GasProfiler {
  private static COLD_SLOAD_COST = 2100;
  private static WARM_SLOAD_COST = 100;
  private static COLD_SSTORE_COST = 20000;
  private static WARM_SSTORE_COST = 5000;
  private static BIT_OP_COST = 3;

  static calculateUpdateCost(operations: any[]): { totalGas: number, details: any[] } {
    let totalGas = 0;
    const details = [];

    for (const op of operations) {
      let opGas = 0;
      // Read cost
      for (const read of op.reads) {
        opGas += read.isCold ? this.COLD_SLOAD_COST : this.WARM_SLOAD_COST;
      }
      // Unpack cost (4 shifts, 4 masks)
      opGas += this.BIT_OP_COST * 8;

      // Write cost
      for (const write of op.writes) {
        opGas += write.isCold ? this.COLD_SSTORE_COST : this.WARM_SSTORE_COST;
      }
      // Pack cost (4 shifts, 4 ORs)
      opGas += this.BIT_OP_COST * 8;

      details.push({
        tick: op.tick,
        wordIndex: op.wordIndex,
        gas: opGas
      });
      totalGas += opGas;
    }

    return { totalGas, details };
  }

  static calculateQueryCost(operations: any[]): { totalGas: number, details: any[] } {
    let totalGas = 0;
    const details = [];

    for (const op of operations) {
        let opGas = 0;
        opGas += op.isCold ? this.COLD_SLOAD_COST : this.WARM_SLOAD_COST;
        opGas += this.BIT_OP_COST * 8; // Unpack cost
        details.push({
            tick: op.tick,
            wordIndex: op.wordIndex,
            gas: opGas
        });
        totalGas += opGas;
    }
    
    return { totalGas, details };
  }
} 