# Scheduled Transfer (TimeLock) Architecture Overview

## 1. Goal
Implement a secure scheduled transfer system where a user can request "Send 100 VCN to Alice in 30 minutes".
The system ensures that funds are locked immediately to prevent double-spending (Nonce dilemma), and the actual transfer is executed by a server-side scheduler (Agent) when the time comes.

## 2. Asset Scope (MVP)
- **VCN Native Token ONLY** (ERC20 support to be added later)

## 3. Core Workflow
1. **User Request**: User asks AI to schedule a transfer.
2. **Drafting**: AI prepares the transaction data.
3. **Deposit (Lock)**: User signs ONE transaction to deposit `100 VCN` into the `TimeLockAgent` contract.
    - `deposit(recipient, unlockTime)`
4. **Waiting**: The funds are safely locked in the contract.
    - UI shows a "Clock" icon indicating pending status.
5. **Execution (Server)**:
    - A backend scheduler (e.g., Cron/Cloud Function) monitors **off-chain database** (not full contract scan).
    - When `unlockTime` passes, the scheduler calls `execute(scheduleId)` on the contract.
    - **Paymaster**: The gas fee for this execution is paid by the server's Paymaster wallet.
6. **Completion**: The contract transfers the VCN to the recipient.

## 4. Status Definitions
| Status | Description | Trigger |
| :--- | :--- | :--- |
| **Draft** | AI parsed intent, waiting for user confirmation | User Intent |
| **Waiting** | Funds deposited in contract, waiting for time | User signs `deposit` |
| **Executing** | Scheduler picked up task, TX broadcasted | Scheduler Cron |
| **Sent** | Blockchain confirmed transfer to recipient | On-chain Event |
| **Failed** | Execution reverted (e.g., gas issues) | On-chain Revert |
| **Cancelled** | User withdrew funds before execution | User calls `cancel` |
| **Expired** | (Optional) Time passed but not executed for N days | Logic limit |

## 5. Technical Constraints
- **NO On-chain Polling**: The scheduler must NOT scan `0` to `N` items on the contract every minute.
    - Instead, we sync `Deposit` events to a DB (Firebase/Postgres) and query the DB for "due tasks".
- **Gas Fee Principle**:
    - **Deposit**: User pays (standard TX).
    - **Execute**: Server (Paymaster) pays.

## 6. Contract Interfaces (Draft)
```solidity
interface ITimeLockAgent {
    event Deposited(uint256 indexed id, address indexed sender, address recipient, uint256 amount, uint256 unlockTime);
    event Executed(uint256 indexed id, address indexed recipient, uint256 amount);
    event Cancelled(uint256 indexed id, address indexed sender, uint256 amount);

    // User calls this
    function deposit(address recipient, uint256 unlockTime) external payable returns (uint256 id);

    // Anyone (Scheduler) calls this
    function execute(uint256 id) external;

    // User can cancel before execution
    function cancel(uint256 id) external;
}
```
