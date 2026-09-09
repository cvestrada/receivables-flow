// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {IHederaScheduleService} from '../IHederaScheduleService.sol';

/**
 * Stands in for Hedera's schedule service so the settlement tests can run on Hardhat.
 *
 * Hardhat is a plain EVM with nothing at `0x16b`, so a settlement that books its maturity call
 * would revert there for a reason that has nothing to do with the rule being tested. The tests
 * place this contract's code at that address instead, which lets them assert what was booked
 * and, separately, what happens when the network turns a booking down.
 *
 * It also fires the booked call on demand, because sixty days is not a wait a test can make.
 * The call goes out from this address, which is why the settlement contract accepts the
 * schedule service as a caller of its maturity entry point alongside itself.
 */
contract MockScheduleService is IHederaScheduleService {
    /** Hedera's code for a request the network accepted. */
    int64 private constant SUCCESS = 22;

    /** Hedera's code for a request the network turned down. */
    int64 private constant INVALID_TRANSACTION = 21;

    /** What the last booking asked for, kept so a test can read it back. */
    struct Booking {
        address to;
        uint256 expirySecond;
        uint256 gasLimit;
        bytes callData;
    }

    Booking private lastBooking;

    /** Set by a test to make the next booking fail the way a full network would. */
    bool public refusing;

    /** How many bookings have been taken, so a test can tell one sale's booking from none. */
    uint256 public bookings;

    function setRefusing(bool value) external {
        refusing = value;
    }

    /**
     * Clears what previous tests left behind.
     *
     * Placing code at `0x16b` does not touch the storage already sitting there, so without
     * this a test would read the booking made by the test before it.
     */
    function reset() external {
        refusing = false;
        bookings = 0;
        delete lastBooking;
    }

    function scheduleCall(
        address to,
        uint256 expirySecond,
        uint256 gasLimit,
        uint64,
        bytes calldata callData
    ) external override returns (int64 responseCode, address scheduleAddress) {
        if (refusing) return (INVALID_TRANSACTION, address(0));

        lastBooking = Booking({to: to, expirySecond: expirySecond, gasLimit: gasLimit, callData: callData});
        bookings++;

        /*
         * The real service hands back a fresh address per booking. A value derived from the
         * count is enough for a test to tell "something was booked" from "nothing was", and
         * keeps successive bookings distinguishable.
         */
        return (SUCCESS, address(uint160(bookings)));
    }

    function hasScheduleCapacity(uint256, uint256) external view override returns (bool) {
        return !refusing;
    }

    /** Reads back what the settlement contract asked the network to hold. */
    function booking() external view returns (Booking memory) {
        return lastBooking;
    }

    /** Delivers the booked call now, standing in for the network reaching the due second. */
    function fire() external {
        (bool ok, ) = lastBooking.to.call(lastBooking.callData);
        require(ok, 'scheduled call reverted');
    }
}
