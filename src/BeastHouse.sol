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
import {HQ, BeastInfo, BeastState} from "./HQ.sol";

using Schema for State;

interface HouseActions {
    function FEED(bytes24 bagBeast) external;
    function PUT(bytes24 bagBeast) external;
    function COLLECT(bytes24 bagBeast) external;
}

contract BeastHouse is BuildingKind {
    uint8 constant BED_BAG_SLOT = 2;
    HQ public hq;

    function init(HQ _hq) public {
        hq = _hq;
    }

    function use(Game ds, bytes24 buildingInstance, bytes24 mobileUnit, bytes calldata payload) public {
        require(address(hq) != address(0), "HQ address not set");

        if (bytes4(payload) == HouseActions.PUT.selector) {
            (bytes24 bagBeast) = abi.decode(payload[4:], (bytes24));

            _put(ds, bagBeast, buildingInstance, mobileUnit);
        }

        if (bytes4(payload) == HouseActions.COLLECT.selector) {
            (bytes24 bagBeast) = abi.decode(payload[4:], (bytes24));

            _collect(ds, bagBeast, buildingInstance, mobileUnit, 2);
        }
    }

    function _put(Game ds, bytes24 bagBeast, bytes24 buildingInstance, bytes24 mobileUnit) private {
        State s = ds.getState();
        // Dispatcher d = ds.getDispatcher();

        bytes24 housedBeast = s.getEquipSlot(buildingInstance, 2);
        require(housedBeast == bagBeast, "Beast requested for put didn't match beast in house");

        hq.putBeast(s, bagBeast, buildingInstance, mobileUnit);
    }

    function _collect(Game ds, bytes24 bagBeast, bytes24 buildingInstance, bytes24 mobileUnit, uint8 destEquipSlot)
        private
    {
        State s = ds.getState();
        Dispatcher d = ds.getDispatcher();

        bytes24 housedBeast = s.getEquipSlot(buildingInstance, 2);
        require(housedBeast == bagBeast, "Beast requested for collection doesn't match beast in house");

        d.dispatch(abi.encodeCall(Actions.TRANSFER_BAG, (bagBeast, buildingInstance, mobileUnit, destEquipSlot)));
        hq.collectBeast(s, bagBeast, buildingInstance, mobileUnit);
    }
}
