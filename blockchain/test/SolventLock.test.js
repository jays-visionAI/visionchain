const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Validates the core correctness property of the Solvent Lock market:
 * secondary-market trading of a linearly-vesting lock token must NOT allow
 * total claimed underlying to exceed what actually vested (no double-claim).
 *
 * The naive `balance * vestedFraction` model would let a seller and a later
 * buyer each claim the same vested slice. The crystallization model prevents it.
 */
describe("SolventLock — vesting conservation under secondary-market trades", function () {
  const E18 = 10n ** 18n;
  const TOTAL = 100n * E18; // 100 lock tokens (= 100 underlying at full vest)

  let admin, settler, issuer, alice, bob, feeCollector;
  let underlying, quote, registry, settlement, vault;
  let lockId;
  let start, duration;

  beforeEach(async function () {
    [admin, settler, issuer, alice, bob, feeCollector] = await ethers.getSigners();

    underlying = await ethers.deployContract("MockUSDT");
    quote = await ethers.deployContract("MockUSDT");

    registry = await ethers.deployContract("SolventLockRegistry", [admin.address]);
    settlement = await ethers.deployContract("SolventLockSettlement", [
      admin.address, settler.address, await quote.getAddress(), feeCollector.address,
    ]);
    vault = await ethers.deployContract("SolventLockVault", [admin.address]);

    // Wire the three contracts together.
    await registry.setWiring(await settlement.getAddress(), await vault.getAddress());
    await settlement.setVault(await vault.getAddress());
    await settlement.grantRegistry(await registry.getAddress());
    await vault.grantRegistry(await registry.getAddress());
    await vault.grantSettler(await settlement.getAddress());

    // Issuer registers a lock token: cliff 0, linear over `duration`, starting soon.
    await registry.grantRole(await registry.ISSUER_ROLE(), issuer.address);
    await underlying.mint(issuer.address, TOTAL);
    await underlying.connect(issuer).approve(await vault.getAddress(), TOTAL);

    const now = await time.latest();
    start = now + 100;
    duration = 1000;
    const tx = await registry.connect(issuer).registerLockToken(
      await underlying.getAddress(),
      TOTAL,
      { startTime: start, cliffDuration: 0, vestingDuration: duration },
      E18, // listingPrice (reference)
    );
    const rcpt = await tx.wait();
    lockId = 1n; // first registered token

    await registry.setTradingEnabled(lockId, true);

    // Fund Alice & Bob with quote so they can buy.
    await quote.mint(alice.address, 1000n * E18);
    await quote.mint(bob.address, 1000n * E18);
    await quote.connect(alice).approve(await settlement.getAddress(), 1000n * E18);
    await quote.connect(bob).approve(await settlement.getAddress(), 1000n * E18);
    await settlement.connect(alice).depositQuote(1000n * E18);
    await settlement.connect(bob).depositQuote(1000n * E18);
  });

  it("splits vested underlying correctly when a holder sells mid-vest", async function () {
    // Round 1 (pre-TGE, f=0): issuer sells all 100 lock to Alice for 10 quote.
    await settlement.connect(settler).settleBatch(1, [{
      buyer: alice.address, seller: issuer.address, lockId,
      lockAmount: TOTAL, quoteAmount: 10n * E18, buyerFee: 0, sellerFee: 0,
    }]);
    expect(await settlement.getLockBalance(alice.address, lockId)).to.equal(TOTAL);

    // Advance to 50% vested.
    await time.increaseTo(start + duration / 2);
    expect(await settlement.vestedFraction(lockId)).to.equal(E18 / 2n);

    // Round 2 (f≈0.5): Alice sells all 100 lock to Bob.
    await settlement.connect(settler).settleBatch(2, [{
      buyer: bob.address, seller: alice.address, lockId,
      lockAmount: TOTAL, quoteAmount: 20n * E18, buyerFee: 0, sellerFee: 0,
    }]);

    // Advance to fully vested.
    await time.increaseTo(start + duration + 1);
    expect(await settlement.vestedFraction(lockId)).to.equal(E18);

    // Crystallization: Alice held 100 up to the sale point, Bob from then on.
    // The split tracks the EXACT vested fraction at the sale block (~50%, ±1s drift),
    // so each is ~50 ± a fraction. The invariant that matters is conservation.
    const aliceClaimable = await settlement.claimable(alice.address, lockId);
    const bobClaimable = await settlement.claimable(bob.address, lockId);
    const issuerClaimable = await settlement.claimable(issuer.address, lockId);

    // Each side is within 1% of the 50/50 split (block-time drift only).
    const onePct = E18; // 1.0 token
    expect(aliceClaimable).to.be.closeTo(50n * E18, onePct);
    expect(bobClaimable).to.be.closeTo(50n * E18, onePct);
    expect(issuerClaimable).to.equal(0n);

    // Conservation: total claimable == total escrowed, exactly. No double-claim.
    expect(aliceClaimable + bobClaimable + issuerClaimable).to.equal(TOTAL);

    // Both actually claim and receive real underlying; vault drains to exactly zero.
    await settlement.connect(alice).claim(lockId);
    await settlement.connect(bob).claim(lockId);
    expect(await underlying.balanceOf(alice.address)).to.equal(aliceClaimable);
    expect(await underlying.balanceOf(bob.address)).to.equal(bobClaimable);
    expect(await vault.escrowed(lockId)).to.equal(0n);
  });

  it("reverts a settle on a token whose trading is disabled", async function () {
    await registry.setTradingEnabled(lockId, false);
    await expect(
      settlement.connect(settler).settleBatch(1, [{
        buyer: alice.address, seller: issuer.address, lockId,
        lockAmount: TOTAL, quoteAmount: 10n * E18, buyerFee: 0, sellerFee: 0,
      }])
    ).to.be.revertedWith("Lock not active");
  });
});
