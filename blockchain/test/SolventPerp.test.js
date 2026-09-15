const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Core perp mechanics: position averaging, realized PnL on close, initial-margin
 * gating, and liquidation when an account goes underwater.
 */
describe("SolventPerp — positions, PnL, liquidation", function () {
  const E18 = 10n ** 18n;
  const MARKET = 1n;

  let admin, settler, oracle, alice, bob, liquidator, feeCollector;
  let usdt, perp;

  async function deposit(who, amt) {
    await usdt.mint(who.address, amt);
    await usdt.connect(who).approve(await perp.getAddress(), amt);
    await perp.connect(who).deposit(amt);
  }

  beforeEach(async function () {
    [admin, settler, oracle, alice, bob, liquidator, feeCollector] = await ethers.getSigners();
    usdt = await ethers.deployContract("MockUSDT");
    perp = await ethers.deployContract("SolventPerp", [
      admin.address, settler.address, oracle.address, await usdt.getAddress(), feeCollector.address,
    ]);
    // 5% maintenance, 10% initial (=> 10x max leverage).
    await perp.configureMarket(MARKET, 500, 1000);
    await perp.connect(oracle).setMarkPrice(MARKET, 100n * E18); // mark 100

    await deposit(alice, 1000n * E18);
    await deposit(bob, 1000n * E18);
  });

  it("opens opposing positions and tracks entry price", async function () {
    // Alice buys (long) 5 @ 100 from Bob (short) 5 @ 100.
    await perp.connect(settler).settleBatch(1, [{
      marketId: MARKET, buyer: alice.address, seller: bob.address,
      size: 5n * E18, price: 100n * E18, buyerFee: 0, sellerFee: 0,
    }]);

    const a = await perp.getPosition(MARKET, alice.address);
    const b = await perp.getPosition(MARKET, bob.address);
    expect(a.size).to.equal(5n * E18);
    expect(a.entryPrice).to.equal(100n * E18);
    expect(b.size).to.equal(-5n * E18);
    expect(b.entryPrice).to.equal(100n * E18);
  });

  it("realizes PnL on close after a price move", async function () {
    await perp.connect(settler).settleBatch(1, [{
      marketId: MARKET, buyer: alice.address, seller: bob.address,
      size: 5n * E18, price: 100n * E18, buyerFee: 0, sellerFee: 0,
    }]);

    // Mark rises to 120. Alice long +5 → unrealized +100. Close by selling 5 @ 120.
    await perp.connect(oracle).setMarkPrice(MARKET, 120n * E18);
    await perp.connect(settler).settleBatch(2, [{
      marketId: MARKET, buyer: bob.address, seller: alice.address,
      size: 5n * E18, price: 120n * E18, buyerFee: 0, sellerFee: 0,
    }]);

    const a = await perp.getPosition(MARKET, alice.address);
    expect(a.size).to.equal(0n);
    // Alice profit = 5 * (120 - 100) = 100 USDT added to her 1000 collateral.
    expect(await perp.collateral(alice.address)).to.equal(1100n * E18);
    // Bob was short 5 from 100, bought back at 120 → loss 100.
    expect(await perp.collateral(bob.address)).to.equal(900n * E18);
  });

  it("blocks a trade that breaches initial margin", async function () {
    // Tiny collateral account tries a huge position.
    const poor = (await ethers.getSigners())[8];
    await deposit(poor, 10n * E18); // 10 USDT
    // 100 size @ 100 = notional 10,000; initial margin 10% = 1000 >> equity 10.
    await expect(
      perp.connect(settler).settleBatch(1, [{
        marketId: MARKET, buyer: poor.address, seller: bob.address,
        size: 100n * E18, price: 100n * E18, buyerFee: 0, sellerFee: 0,
      }])
    ).to.be.revertedWith("Buyer IM");
  });

  it("liquidates an underwater long", async function () {
    // Alice opens a near-max long: size 90 @ 100 = notional 9000, IM 10% = 900 <= equity 1000. OK.
    await perp.connect(settler).settleBatch(1, [{
      marketId: MARKET, buyer: alice.address, seller: bob.address,
      size: 90n * E18, price: 100n * E18, buyerFee: 0, sellerFee: 0,
    }]);
    expect(await perp.isLiquidatable(MARKET, alice.address)).to.equal(false);

    // Mark drops to 89: uPnL = 90*(89-100) = -990 → equity = 1000-990 = 10.
    // Maintenance req = notional(90*89=8010)*5% = 400.5 > 10 → liquidatable.
    await perp.connect(oracle).setMarkPrice(MARKET, 89n * E18);
    expect(await perp.isLiquidatable(MARKET, alice.address)).to.equal(true);

    await perp.connect(liquidator).liquidate(MARKET, alice.address);
    const a = await perp.getPosition(MARKET, alice.address);
    expect(a.size).to.equal(0n);
    // Liquidator received a penalty cut; Alice's collateral was reduced.
    expect(await perp.collateral(liquidator.address)).to.be.greaterThan(0n);
  });
});
