# Incident Runbook: Vision Chain Interop Security

## 🚨 Emergency Contacts
- **Security Council Multisig**: `0xAdmin...`
- **Lead Dev**: Jaya (Slack: @jays)
- **LayerZero Contact**: `security@layerzero.network`

## 1. Incident Levels

| Level | Description | Example | Action |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Active loss of funds, Bridge Exploit | Infinite mint bug, Relayer compromise | **PAUSE IMMEDIATELY** |
| **SEV-2 (High)** | Service degradation, Potential vulnerability | Paymaster draining, 1/3 Validator offline | **Rate Limit / Rotate Keys** |
| **SEV-3 (Low)** | UI Bug, Non-blocking error | Dashboard sync fail | **Hotfix** |

## 2. Emergency Procedures

### Scenario A: Bridge Exploit Detected (SEV-1)
**Goal**: Stop the bleeding within 5 minutes.

1.  **ACKNOWLEDGE**: Confirm unusual outflow on Dashboard.
2.  **PAUSE EQUALIZER**:
    ```bash
    npx hardhat run scripts/emergency/pause_equalizer.js --network vision
    ```
    *Effect: All cross-chain withdrawals halt. Deposits queue up.*
3.  **INVESTIGATE**: Check `failedMessages` and `lzReceive` logs.
4.  **FIX**: deploy patched contract.
5.  **UNPAUSE**:
    ```bash
    npx hardhat run scripts/emergency/unpause_equalizer.js --network vision
    ```

### Scenario B: Paymaster Draining (SEV-2)
**Goal**: Stop free gas abuse.

1.  **PAUSE PAYMASTER**:
    ```bash
    npx hardhat eval "await (await ethers.getContractAt('VCNPaymasterV2', '...')).pause()" --network vision
    ```
2.  **BAN USER**: Add abusive address to deny-list.
3.  **ROTATE TSS KEY** (If key leaked):
    ```bash
    npx hardhat run scripts/emergency/rotate_tss.js --network vision
    ```

### Scenario C: LayerZero Endpoint Failure
**Goal**: Failover to manual relay.

1.  **DISABLE LZ PATH**: Set trusted remote to `false` for affected chain.
2.  **ANNOUNCE**: Inform users of "Maintenance Mode".

## 3. Post-Mortem
After every SEV-1/2 incident, a report MUST be written including:
- Timeline of events
- Root cause analysis
- Action items to prevent recurrence
