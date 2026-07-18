// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

interface IFtsoReader {
    function getFeedByIdInWei(bytes21 feedId)
        external
        view
        returns (uint256 value, uint64 timestamp);
}
