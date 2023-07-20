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
import {HQ, EggEntry, EggState} from "./HQ.sol";

using Schema for State;

interface HouseActions {
    function feed() external;
    function put() external;
    function collect() external;
}

contract BeastHouse is BuildingKind {
    uint8 constant BED_BAG_SLOT = 2;
    HQ public hq;

    function init(HQ _hq) public {
        hq = _hq;
    }

    function use(Game ds, bytes24 buildingInstance, bytes24 mobileUnit, bytes calldata payload) public {
        require(address(hq) != address(0), "HQ address not set");

        uint256 eggIndex = hq.ownerToEggIndex(mobileUnit);

        require(eggIndex > 0, "You must own a Bag Beast to use this building");

        State s = ds.getState();
        // Dispatcher d = ds.getDispatcher();

        if (bytes4(payload) == HouseActions.put.selector) {
            // (bytes24 sendBag, bytes24 toUnit, bytes24 toOffice, bytes24 payBag) =
            //     abi.decode(payload[4:], (bytes24, bytes24, bytes24, bytes24));

            // -- Get the first bag on the building
            bytes24 bag = s.getEquipSlot(buildingInstance, 0);

            // -- Check if that slot 0 contains a beast
            {
                (bytes24 resource, uint64 balance) = s.getItemSlot(bag, 0);
                require(resource == hq.beastItem() && balance == 1, "Item slot zero doesn't contain a beast");
            }

            // -- Transfer from bag 0 to bag 2

            // A private bag that the beast goes into
            bytes24 bedBag = s.getEquipSlot(buildingInstance, BED_BAG_SLOT);
            if (bedBag == bytes24(0)) {
                ds.getDispatcher().dispatch(abi.encodeCall(Actions.SPAWN_EMPTY_BAG, (buildingInstance, BED_BAG_SLOT)));
                bedBag = s.getEquipSlot(buildingInstance, BED_BAG_SLOT);
            }

            (bytes24 beastItem, uint64 bal) = s.getItemSlot(bedBag, 0);
            if (beastItem == hq.beastItem() && bal == 1) {
                revert("Already a beast in this house");
            }

            // TODO: There isn't a rule for a building transferring items
            s.clearItemSlot(bag, 0);
            s.setItemSlot(bedBag, BED_BAG_SLOT, beastItem, 1);

            // -- Register this fact somewhere?
            hq.putBeast(s, buildingInstance, mobileUnit);
        }
    }
}
