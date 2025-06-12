# Packed Fenwick Tree Auction Simulator

This project is a TypeScript-based command-line tool for simulating and visualizing a gas-efficient Fenwick tree implementation designed for on-chain auctions. The key innovation is the use of a "packed" tree, where multiple 64-bit tick values are packed into a single 256-bit storage word, drastically reducing storage operations.

The simulator allows you to step through an auction, place bids, and clear the book, providing detailed visualizations and gas cost analysis for every operation.

## Features

- **Interactive CLI:** A step-by-step auction simulator.
- **Packed Fenwick Tree:** Implements a gas-efficient data structure where 4 `uint64` values are packed into a single `uint256` word.
- **Multiple Visualizations:**
    - **Memory Layout:** Shows the raw `(word -> packed_value)` storage, highlighting which words are accessed.
    - **ASCII Tree:** Renders the logical parent-child structure of the Fenwick tree.
    - **Binary Update Path:** Details the bitwise math used to find parent nodes for any given update.
- **Gas Profiling:** Provides gas cost estimates for all operations, distinguishing between cold and warm storage access.
- **Dynamic Bidding:** Simulates a realistic market by generating new bids based on the last clearing price.

## Getting Started

### Prerequisites

- Node.js (v14 or higher recommended)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository_url>
   cd tree-exploration
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

### Running the Simulator

To start the interactive command-line tool, run:

```bash
npm run cli
```

## How to Use the Simulator

The CLI provides a menu with three options:

1.  **Place a new random bid:** This generates a new bid based on the last clearing price and applies it to the tree. The simulation will display:
    - Gas cost breakdown for the update.
    - The binary math for the update path.
    - The new memory layout.
    - The new ASCII tree structure.

2.  **Clear auction:** This initiates the two-phase clearing process.
    - **Phase 1 (Search):** You'll be prompted for a target volume. The simulator performs a binary search to find the clearing price and displays the gas cost for this read-only operation.
    - **Phase 2 (Write):** The simulator removes the cleared volume from the tree, applying negative updates and displaying the gas cost for these write operations.

3.  **Exit:** Terminates the simulation.

## Understanding the Data Structures

The core of this project is the Fenwick tree (also known as a Binary Indexed Tree or BIT). Its key properties are:

- **`O(log n)` Updates:** When a value is updated, it propagates the change to `log n` parent nodes.
- **`O(log n)` Queries:** The cumulative sum up to any index can be found by querying `log n` nodes.
- **Implicit Structure:** Parent-child relationships are calculated using bitwise math (`parent = index + (index & -index)`), not stored pointers. This makes it extremely gas-efficient as there is no storage overhead for maintaining the tree structure.
- **Sparse Storage:** The tree is stored in a `Map`, so only non-zero words consume storage, making it ideal for sparse bid distributions. 