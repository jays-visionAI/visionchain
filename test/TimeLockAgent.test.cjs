const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("TimeLockAgent", function () {
    let TimeLockAgent, timeLock;
    let owner, user1, user2, executor;
    const ONE_HOUR = 60 * 60;
    const ONE_VCN = ethers.parseEther("1.0");

    beforeEach(async function () {
        [owner, user1, user2, executor] = await ethers.getSigners();

        const TimeLockAgentFactory = await ethers.getContractFactory("TimeLockAgent");
        timeLock = await TimeLockAgentFactory.deploy();
        await timeLock.waitForDeployment();

        // Register executor
        await timeLock.setExecutor(executor.address, true);
    });

    describe("Scheduling", function () {
        it("Should allow user to schedule a transfer", async function () {
            const unlockTime = (await time.latest()) + ONE_HOUR;

            const tx = await timeLock.connect(user1).scheduleTransferNative(
                user2.address,
                unlockTime,
                { value: ONE_VCN }
            );

            await expect(tx)
                .to.emit(timeLock, "TransferScheduled")
                .withArgs(0, user1.address, user2.address, ONE_VCN, unlockTime);

            const schedule = await timeLock.transfers(0);
            expect(schedule.amount).to.equal(ONE_VCN);
            expect(schedule.status).to.equal(0); // Waiting
        });

        it("Should fail if unlock time is in the past", async function () {
            const pastTime = (await time.latest()) - ONE_HOUR;
            await expect(
                timeLock.connect(user1).scheduleTransferNative(user2.address, pastTime, { value: ONE_VCN })
            ).to.be.revertedWith("TimeLockAgent: Unlock time must be in future");
        });
    });

    describe("Execution", function () {
        it("Should prevent execution before unlock time", async function () {
            const unlockTime = (await time.latest()) + ONE_HOUR;
            await timeLock.connect(user1).scheduleTransferNative(user2.address, unlockTime, { value: ONE_VCN });

            await expect(
                timeLock.connect(executor).executeTransfer(0)
            ).to.be.revertedWith("TimeLockAgent: Time locked");
        });

        it("Should allow executor to execute after unlock time", async function () {
            const unlockTime = (await time.latest()) + ONE_HOUR;
            await timeLock.connect(user1).scheduleTransferNative(user2.address, unlockTime, { value: ONE_VCN });

            // Fast forward time
            await time.increaseTo(unlockTime + 1);

            const tx = await timeLock.connect(executor).executeTransfer(0);

            await expect(tx)
                .to.emit(timeLock, "TransferExecuted")
                .withArgs(0, executor.address, await time.latest()); // check basically latest

            // Check balances
            // Note: Logic for checking balances inside test might be complex due to gas used, 
            // effectively mostly relying on status update and event emission 
            // to prove transfer occurred in internal transaction.
            // We can check change in user2 balance roughly
            await expect(tx).to.changeEtherBalance(user2, ONE_VCN);

            const schedule = await timeLock.transfers(0);
            expect(schedule.status).to.equal(1); // Executed
        });
    });

    describe("Cancellation", function () {
        it("Should allow creator to cancel before unlock time", async function () {
            const unlockTime = (await time.latest()) + ONE_HOUR;
            await timeLock.connect(user1).scheduleTransferNative(user2.address, unlockTime, { value: ONE_VCN });

            // Check balance change for refund
            await expect(
                timeLock.connect(user1).cancelTransfer(0)
            ).to.changeEtherBalance(user1, ONE_VCN); // Should get refund

            const schedule = await timeLock.transfers(0);
            expect(schedule.status).to.equal(2); // Cancelled
        });

        it("Should not allow cancellation after unlock time (use expire instead if implemented or strict check)", async function () {
            const unlockTime = (await time.latest()) + ONE_HOUR;
            await timeLock.connect(user1).scheduleTransferNative(user2.address, unlockTime, { value: ONE_VCN });

            await time.increaseTo(unlockTime + 1);

            await expect(
                timeLock.connect(user1).cancelTransfer(0)
            ).to.be.revertedWith("TimeLockAgent: Too late to cancel, use expire if stale");
        });
    });
});
