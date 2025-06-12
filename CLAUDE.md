# Tree Exploration Project Guide

## Commands
- **Build**: `npm run build` - Compiles TS to JS in dist/
- **Run**: `npm run start` - Executes src/index.ts with ts-node
- **Dev**: `npm run dev [file.ts]` - Run any TS file with ts-node

## Code Style
- **Types**: Use TypeScript strict mode; prefer explicit types over inference
- **BigInt**: Use bigint for numeric values (especially for Solidity representation)
- **Naming**:
  - Classes: PascalCase (e.g., `FenwickTree`)
  - Variables/functions: camelCase (e.g., `totalVolume`)
  - Interfaces: PascalCase, no "I" prefix
- **Interfaces**: Prefer interfaces over type aliases for objects
- **Error Handling**: Use explicit error messages with try/catch blocks
- **Comments**: Document complex algorithms and class purposes
- **Formatting**: Use 2-space indentation; trailing semicolons required

## Project Structure
- Source code in `src/` directory
- Output compiled to `dist/` directory
- Keep utility functions in their own modules when adding new functionality