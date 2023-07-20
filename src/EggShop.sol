// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "forge-std/console2.sol";
import {Game} from "cog/Game.sol";
import {Actions} from "@ds/actions/Actions.sol";
import {BuildingKind} from "@ds/ext/BuildingKind.sol";
import {console} from "forge-std/console.sol";
import {State} from "cog/State.sol";
import {Rel, Schema, Kind, Node} from "@ds/schema/Schema.sol";
import {Dispatcher} from "cog/Dispatcher.sol";
import "@ds/utils/Base64.sol";
import {HQ} from "./HQ.sol";

using Schema for State;

enum EggState {
    baby,
    adult,
    escaped
}

struct EggEntry {
    uint256 index;
    bytes24 owner;
    EggState state;
    uint256 lastFedBlock;
    uint256 bornBlock;
    uint256 eggNum;
}
// string name; // TODO: leaving out for the minute because decoding string annoying in frontend

contract EggShop is BuildingKind {
    HQ public hq;

    function init(HQ _hq) public {
        hq = _hq;
    }

    function use(Game ds, bytes24 buildingInstance, bytes24 mobileUnit, bytes calldata /*payload*/ ) public {
        State s = ds.getState();

        hq.createEgg(s, mobileUnit);

        ds.getDispatcher().dispatch(abi.encodeCall(Actions.CRAFT, (buildingInstance)));
    }
}
