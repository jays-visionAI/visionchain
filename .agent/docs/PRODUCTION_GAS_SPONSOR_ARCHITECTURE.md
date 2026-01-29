# Production Gas Sponsor Architecture

## Current State (Testnet)

### VCN 일반 전송
- **방식**: Paymaster API를 통한 Gasless Transfer
- **수수료**: 1 VCN (VCN에서 차감)
- **상태**: ✅ 구현됨 (`sendGaslessTokens`)

### Time-lock 전송
- **방식**: 사용자가 직접 가스비 지불
- **문제점**: 가스비 부족 시 실패, 데모용 자동 에어드랍 의존
- **상태**: ⚠️ 테스트넷 전용

---

## Production Architecture Proposal

### 1. Gas Estimation (정확한 가스 추정)

```typescript
async estimateTimeLockGas(recipient: string, amount: string, delaySeconds: number): Promise<{
  gasLimit: bigint;
  gasPrice: bigint;
  totalCostVCN: string;
}> {
  const provider = await this.getRobustProvider();
  const timelockAddress = ADDRESSES.TIME_LOCK_AGENT;
  const abi = ["function scheduleTransferNative(address to, uint256 unlockTime) external payable returns (uint256)"];
  const contract = new ethers.Contract(timelockAddress, abi, provider);
  
  const amountWei = ethers.parseEther(amount);
  const unlockTime = Math.floor(Date.now() / 1000) + delaySeconds;
  
  // Estimate gas
  const gasLimit = await contract.scheduleTransferNative.estimateGas(
    recipient, 
    unlockTime, 
    { value: amountWei, from: ADDRESSES.VCN_PAYMASTER } // Simulate from admin
  );
  
  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice || ethers.parseUnits("1", "gwei");
  
  const totalCostWei = gasLimit * gasPrice;
  const totalCostVCN = ethers.formatEther(totalCostWei);
  
  return { gasLimit, gasPrice, totalCostVCN };
}
```

### 2. Gasless Time-lock (Paymaster 대납 구조)

```typescript
async scheduleTimeLockGasless(
  recipient: string, 
  amount: string, 
  delaySeconds: number
): Promise<{ receipt: any; scheduleId: string }> {
  if (!this.signer) throw new Error("Wallet not connected");

  const userAddress = await this.signer.getAddress();
  const amountWei = ethers.parseEther(amount);
  const unlockTime = Math.floor(Date.now() / 1000) + delaySeconds;
  
  // 1. Estimate gas cost + add 10% buffer
  const gasEstimate = await this.estimateTimeLockGas(recipient, amount, delaySeconds);
  const gasFeeVCN = parseFloat(gasEstimate.totalCostVCN) * 1.1; // 10% buffer
  const serviceFee = 1; // 1 VCN fixed service fee
  const totalFee = gasFeeVCN + serviceFee;
  
  // 2. Create EIP-712 signature for Permit
  // (Similar to sendGaslessTokens but for TimeLock)
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  const signature = await this.signTimeLockPermit(userAddress, totalFee, deadline);
  
  // 3. Submit to Paymaster API
  const response = await fetch(`${ADDRESSES.SEQUENCER_URL.replace('/submit', '')}/paymaster/timelock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: userAddress,
      recipient,
      amount: amountWei.toString(),
      unlockTime,
      fee: ethers.parseEther(totalFee.toString()).toString(),
      deadline,
      signature
    })
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`TimeLock Paymaster Failed: ${error.error || response.statusText}`);
  }
  
  return await response.json();
}
```

### 3. Backend Paymaster Endpoint

```javascript
// api/paymaster/timelock.js
app.post('/paymaster/timelock', async (req, res) => {
  try {
    const { user, recipient, amount, unlockTime, fee, deadline, signature } = req.body;
    
    // 1. Verify signature
    const isValid = await verifyPermitSignature(user, fee, deadline, signature);
    if (!isValid) throw new Error("Invalid signature");
    
    // 2. Collect fee from user via permit
    await collectFeeWithPermit(user, fee, signature);
    
    // 3. Execute TimeLock on behalf of user (Admin wallet pays gas)
    const adminWallet = new ethers.Wallet(ADMIN_PK, provider);
    const timelockContract = new ethers.Contract(TIMELOCK_ADDRESS, ABI, adminWallet);
    
    const tx = await timelockContract.scheduleTransferNativeFor(user, recipient, unlockTime, { value: amount });
    const receipt = await tx.wait();
    
    // 4. Parse schedule ID from event
    const scheduleId = parseScheduleId(receipt);
    
    res.json({ success: true, txHash: receipt.hash, scheduleId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4. Smart Contract Update (Optional)

Time-lock 컨트랙트에 `scheduleTransferNativeFor` 함수 추가:

```solidity
function scheduleTransferNativeFor(
    address creator,
    address to,
    uint256 unlockTime
) external payable onlyPaymaster returns (uint256) {
    // Execute on behalf of creator
    return _scheduleTransfer(creator, to, msg.value, unlockTime);
}
```

---

## Implementation Priority

| Phase | Task | Effort |
|-------|------|--------|
| 1 | Gas Estimation function | 1-2 hours |
| 2 | Paymaster API endpoint for TimeLock | 3-4 hours |
| 3 | Frontend integration | 1-2 hours |
| 4 | Smart Contract update (optional) | 2-3 hours |

---

## Fee Structure (Proposed)

| Type | Gas Cost | Service Fee | Total |
|------|----------|-------------|-------|
| VCN Transfer | 0 VCN | 1 VCN | 1 VCN |
| Time-lock Schedule | ~0.5 VCN | 1 VCN | ~1.5 VCN |
| Time-lock Execute | ~0.3 VCN | 0 VCN | ~0.3 VCN |

---

## Current Workaround (Testnet Only)

테스트넷에서는 다음과 같이 동작:
1. 사용자 잔액 확인
2. 부족하면 Admin 지갑에서 `전송금액 + 5 VCN` 에어드랍
3. 사용자 지갑으로 트랜잭션 실행

⚠️ 이 방식은 메인넷에서 사용 불가 (낭비 + 보안 이슈)
