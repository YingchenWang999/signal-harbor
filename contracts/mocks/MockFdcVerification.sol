// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IEVMTransaction} from "../vendor/flare/IEVMTransaction.sol";
import {IEVMTransactionVerification} from "../vendor/flare/IEVMTransactionVerification.sol";
import {IXRPPayment} from "../vendor/flare/IXRPPayment.sol";
import {IXRPPaymentVerification} from "../vendor/flare/IXRPPaymentVerification.sol";

contract MockFdcVerification is IEVMTransactionVerification, IXRPPaymentVerification {
    bool public evmValid = true;
    bool public xrpValid = true;

    function setEvmValid(bool nextValid) external {
        evmValid = nextValid;
    }

    function setXrpValid(bool nextValid) external {
        xrpValid = nextValid;
    }

    function verifyEVMTransaction(IEVMTransaction.Proof calldata)
        external
        view
        returns (bool)
    {
        return evmValid;
    }

    function verifyXRPPayment(IXRPPayment.Proof calldata)
        external
        view
        returns (bool)
    {
        return xrpValid;
    }
}
