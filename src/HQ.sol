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
    bytes24 house;
}
// string name; // TODO: leaving out for the minute because decoding string annoying in frontend

contract HQ is BuildingKind {
    mapping(bytes24 => uint256) public ownerToEggIndex;
    // mapping(bytes24 => uint256) public houseToBeastIndex;

    EggEntry[] public eggs;
    bytes24 public ledger;
    uint256 public eggNum;
    bytes24 public beastItem;

    function init(Game ds, bytes24 _ledger, bytes24 _beastItem) public {
        if (ledger == bytes24(0)) {
            require(_ledger != bytes24(0), "HQ::Init: Cannot set ledger to null");

            console2.log("HQ::Init: Setting ledger: ", uint256(bytes32(_ledger)));
            ledger = _ledger;

            // Make a null entry for entry 0
            createEgg(ds.getState(), bytes24(0));
        } else {
            console2.log("HQ::Init: Ledger already set");
        }

        require(_beastItem != bytes24(0), "HQ::Init: Cannot set beast item to null");
        beastItem = _beastItem;
    }

    function use(Game ds, bytes24 buildingInstance, bytes24 mobileUnit, bytes calldata /*payload*/ ) public {}

    function createEgg(State state, bytes24 mobileUnit) public {
        // Check the player doesn't already have an egg
        uint256 eggIndex = ownerToEggIndex[mobileUnit];
        if (eggIndex > 0) {
            EggEntry storage egg = eggs[eggIndex];
            require(egg.owner == bytes24(0) || egg.state == EggState.escaped, "Player cannot own more than one egg");
        }

        eggs.push(
            EggEntry({
                index: eggs.length,
                owner: mobileUnit, // owned directly by mobileUnit NOT player
                state: EggState.baby,
                lastFedBlock: 0, // we don't start counting feed times until monster is first fed
                bornBlock: block.number,
                // name: "",
                eggNum: eggNum++,
                house: bytes24(0)
            })
        );
        ownerToEggIndex[mobileUnit] = eggs.length - 1;

        _broadcastState(state);
    }

    function putBeast(State state, bytes24 houseInstance, bytes24 mobileUnit) public {
        uint256 eggIndex = ownerToEggIndex[mobileUnit];
        require(eggIndex > 0, "Beast HQ: No beast registered to supplied mobile unit!");

        EggEntry storage egg = eggs[eggIndex];
        require(egg.house == bytes24(0), "Beast HQ: Beast already in a house");

        egg.house = houseInstance;
        _broadcastState(state);
    }

    // -- We might not actually ever delete entries
    //
    // function _deleteEntry(EggEntry storage entry) private {
    //     uint256 index = entry.index;
    //     require(eggs[index].owner == entry.owner, "Entry to be deleted doesn't match entry at index");

    //     // Delete by swapping the last entry with the entry we want to delete and then deleting the last entry
    //     eggs[index] = eggs[eggs.length - 1];
    //     eggs[index].index = index;
    //     eggs.pop();

    //     // Update mapping
    //     ownerToEggIndex[eggs[index].owner] = index;
    //     delete ownerToEggIndex[entry.owner];
    // }

    function _broadcastState(State state) private {
        require(ledger != bytes24(0), "Ledger not set, unable to broadcast state");

        // store the state in the name annotation of the ledger ... again, don't judge me (because Farm's did it first)
        state.annotate(ledger, "name", Base64.encode(abi.encode(eggs)));
    }
}
