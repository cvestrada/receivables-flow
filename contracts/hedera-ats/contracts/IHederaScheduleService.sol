// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/**
 * The part of Hedera's schedule service a contract needs to book its own future call.
 *
 * The service lives at the reserved address `0x16b` on every Hedera network and is not a
 * contract anyone deploys — it is the network itself, reachable from Solidity. Only the two
 * functions this project uses are declared, rather than the whole interface, so the compiler
 * refuses anything the settlement contract was not meant to reach for.
 *
 * Booking a call this way is what replaces a bot, a cron job, or a person remembering: the
 * network holds the instruction and runs it at the second it is due.
 */
interface IHederaScheduleService {
    /**
     * Books a call to `to` for a future second, and returns the schedule it created.
     *
     * @param to - The contract to call when the time arrives
     * @param expirySecond - The epoch second at which the call runs
     * @param gasLimit - Gas the scheduled call may spend
     * @param value - Tinybar to send with the scheduled call
     * @param callData - The encoded call, exactly as it will be delivered
     * @return responseCode - 22 when the network accepted the booking
     * @return scheduleAddress - Where the booking now lives, readable on the explorer
     */
    function scheduleCall(
        address to,
        uint256 expirySecond,
        uint256 gasLimit,
        uint64 value,
        bytes calldata callData
    ) external returns (int64 responseCode, address scheduleAddress);

    /** Reports whether the network can still take a booking at that second. */
    function hasScheduleCapacity(uint256 expirySecond, uint256 gasLimit) external view returns (bool);
}
