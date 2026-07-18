// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IFtsoReader} from "../interfaces/IFtsoReader.sol";

contract MockFtsoReader is IFtsoReader {
    uint256 public value;
    uint64 public updatedAt;

    function setFeed(uint256 newValue, uint64 newTimestamp) external {
        value = newValue;
        updatedAt = newTimestamp;
    }

    function getFeedByIdInWei(bytes21)
        external
        view
        returns (uint256, uint64)
    {
        return (value, updatedAt);
    }
}
