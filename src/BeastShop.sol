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

interface buildingActions {
    function USE(uint8 unitDestEquipSlot, uint24 beastColor) external;
}

contract BeastShop is BuildingKind {
    uint8 public constant BAG_BEAST_SLOT = 2;

    HQ public hq;

    function init(HQ _hq) public {
        hq = _hq;
    }

    function use(Game ds, bytes24 buildingInstance, bytes24 mobileUnit, bytes calldata payload) public {
        State s = ds.getState();
        Dispatcher d = ds.getDispatcher();

        (uint8 unitDestEquipSlot, uint24 beastColor) = abi.decode(payload[4:], (uint8, uint24));

        // Empty slot must be declared
        require(s.getEquipSlot(mobileUnit, unitDestEquipSlot) == bytes24(0), "Destination equip slot must be empty");

        // the bag IS the beast. Bags are unique and is a HACK way of having an NFT... *shrug*
        d.dispatch(abi.encodeCall(Actions.SPAWN_EMPTY_BAG, (buildingInstance, BAG_BEAST_SLOT)));
        bytes24 bagBeast = s.getEquipSlot(buildingInstance, BAG_BEAST_SLOT);

        // registering the bag as the beast
        hq.registerBeast(s, bagBeast, beastColor);

        d.dispatch(abi.encodeCall(Actions.CRAFT, (buildingInstance)));

        // Move the crafted item out of the public building bag into the Bag Beast
        // NOTE: This process is now done with the frontend code due to the problem outlined below
        //
        // NOTE: Buildings are unable to transfer items from bags using TRANSFER_ITEM_MOBILE_UNIT
        //       This is because the buildingInstance is OWNED by the builder but it doesn't match the
        //       sender of the action which is the implementation address
        // d.dispatch(abi.encodeCall(Actions.TRANSFER_ITEM_MOBILE_UNIT, (
        //     mobileUnit,
        //     [buildingInstance, buildingInstance],
        //     [OUTPUT_SLOT, BAG_BEAST_SLOT],
        //     [0,0],
        //     bagBeast, // TODO: This is a weird param. It'll EQUIP this bag if the destination equip slot is empty
        //     1
        // )));

        // Transfer the ownership to the HQ to prevent the player from altering the contents of the bag
        // TODO: BagRule doesn't allow for directly setting entities as owners due to bug with _setOwner
        // d.dispatch(abi.encodeCall(Actions.TRANSFER_BAG_OWNERSHIP, (bagBeast, Node.Player(address(hq)))));

        // Transfer beast to unit
        d.dispatch(abi.encodeCall(Actions.TRANSFER_BAG, (bagBeast, buildingInstance, mobileUnit, unitDestEquipSlot)));
    }
}
