import ds from "downstream";

const nullBytes24 = "0x000000000000000000000000000000000000000000000000";

function decodeState(ledgerBuildings) {
  if (ledgerBuildings.length == 0) return [];

  const base64 = ledgerBuildings[0].kind.outputs[0]?.item?.name?.value;
  if (!base64) return [];

  const binaryString = base64_decode(base64);

  const stateBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    stateBytes[i] = binaryString.charCodeAt(i);
  }

  // TODO: Read all 32 bytes. This will currently break after 255 entries
  const numEntries = stateBytes[63];

  //   struct Beast {
  //     uint256 index;
  //     bytes24 owner;
  //     BeastState state;
  //     uint256 lastFedBlock;
  //     uint256 bornBlock;
  //     uint256 beastNum;
  // }
  const structLen = 32 * 7;
  const ledger = [];
  for (var i = 0; i < numEntries; i++) {
    ledger.push({
      index: toHexString(
        new Uint8Array(stateBytes.buffer, structLen * i + 32 * 2, 32)
      ),
      owner: toHexString(
        new Uint8Array(stateBytes.buffer, structLen * i + 32 * 3, 24)
      ),
      state: Number(
        BigInt(
          "0x" +
            toHexString(
              new Uint8Array(stateBytes.buffer, structLen * i + 32 * 4, 32)
            ).slice(-2)
        )
      ),
      lastFedBlock: Number(
        BigInt(
          "0x" +
            toHexString(
              new Uint8Array(stateBytes.buffer, structLen * i + 32 * 5, 32)
            ).slice(-8)
        )
      ),
      bornBlock: Number(
        BigInt(
          "0x" +
            toHexString(
              new Uint8Array(stateBytes.buffer, structLen * i + 32 * 6, 32)
            ).slice(-8)
        )
      ),
      beastNum: Number(
        BigInt(
          "0x" +
            toHexString(
              new Uint8Array(stateBytes.buffer, structLen * i + 32 * 7, 32)
            ).slice(-8)
        )
      ),
      house: toHexString(
        new Uint8Array(stateBytes.buffer, structLen * i + 32 * 8, 24)
      ),
    });
  }

  return ledger;
}

export default function update({ selected, world }) {
  const { tiles, mobileUnit } = selected || {};
  const selectedTile = tiles && tiles.length === 1 ? tiles[0] : undefined;
  const selectedBuilding = selectedTile?.building;
  const selectedMobileUnit = mobileUnit;

  // fetch the expected inputs item kinds
  const requiredInputs = selectedBuilding?.kind?.inputs || [];
  const want0 = requiredInputs.find((inp) => inp.key == 0);
  const want1 = requiredInputs.find((inp) => inp.key == 1);

  // fetch what is currently in the input slots
  const inputSlots =
    selectedBuilding?.bags.find((b) => b.key == 0).bag?.slots || [];
  const got0 = inputSlots?.find((slot) => slot.key == 0);
  const got1 = inputSlots?.find((slot) => slot.key == 1);

  // fetch our output item details
  const expectedOutputs = selectedBuilding?.kind?.outputs || [];
  const out0 = expectedOutputs?.find((slot) => slot.key == 0);

  // To get the kind ID for the HQ I used https://www.rapidtables.com/convert/number/decimal-to-hex.html to convert the number logged out by the deploy script
  const ledgerBuildings = world.buildings.filter(
    (b) =>
      b.kind?.id ==
      "0xBE92755C00000000000000000000000092CE2DB2BDBDB8D4".toLowerCase()
  );

  const beasts = decodeState(ledgerBuildings);
  const playersBeast = beasts.filter(
    (beast) => beast.owner == selectedMobileUnit.id
  );

  const BLOCK_TIME_SECS = 10;

  // try to detect if the input slots contain enough stuff to craft
  const canCraft =
    selectedMobileUnit &&
    want0 &&
    got0 &&
    want0.balance == got0.balance &&
    want1 &&
    got1 &&
    want1.balance == got1.balance &&
    playersBeast.length == 0;

  const craft = () => {
    if (!selectedMobileUnit) {
      ds.log("no unit selected");
      return;
    }
    if (!selectedBuilding) {
      ds.log("no building selected");
      return;
    }

    const destEquipSlot = 2;
    const payload = ds.encodeCall("function USE(uint8 unitDestEquipSlot)", [
      destEquipSlot,
    ]);
    ds.dispatch(
      {
        name: "BUILDING_USE",
        args: [selectedBuilding.id, selectedMobileUnit.id, payload],
      },
      {
        name: "TRANSFER_ITEM_MOBILE_UNIT",
        args: [
          selectedMobileUnit.id,
          [selectedBuilding.id, selectedMobileUnit.id],
          [1, destEquipSlot],
          [0, 0],
          nullBytes24, // toBagId can be null providing there's a bag at destEquipSlot
          1,
        ],
      }
    );

    ds.log("BeastShop: buy beast");
  };

  const getAliveMinutes = (beast, currentBlock) => {
    return Math.floor(
      ((currentBlock - beast.bornBlock) * BLOCK_TIME_SECS) / 60
    );
  };

  const getLastFedMinutes = (beast, currentBlock) => {
    return Math.floor(
      ((currentBlock - beast.lastFedBlock) * BLOCK_TIME_SECS) / 60
    );
  };

  const getBeastState = (beast, currentBlock) => {
    if (beast.lastFedBlock > 0) {
      const lastFedMinutes = getLastFedMinutes(beast, currentBlock);
      if (lastFedMinutes > 3) {
        return "You beast has run away due to being too hungry!";
      } else if (lastFedMinutes > 1) {
        return "Your bag beast is hungry, you should feed it before it gets too hungry and runs away.";
      } else {
        return "You bag beast is content";
      }
    } else {
      // const aliveMinutes = getAliveMinutes(beast, currentBlock);
      return "You must build a house for your beast and attend to it";
    }
  };

  const getMainText = () => {
    if (ledgerBuildings.length == 0) {
      return `<p>Oh no the Bag Beast HQ has been destroyed. It must be rebuilt for us to keep record of who has which beasts!</p>`;
    } else {
      let html = "";
      html += `<p>Current block: ${world.block}</p>`;
      html += `<p>Beasts sold to date: ${beasts.length}</p>`;
      // html += beasts
      //   .map(
      //     (beast) =>
      //       `<p>idx: ${beast.index.slice(-2)}, owner: ${beast.owner.slice(-6)}</p>`
      //   )
      //   .join("");
      if (playersBeast.length > 0) {
        html += `<p>You have beast number: ${playersBeast[0].beastNum}</p>`;
        html += `<p>Minutes alive: ${getAliveMinutes(
          playersBeast[0],
          world.block
        )}</p>`;
        html += `<p>${getBeastState(playersBeast[0], world.block)}</p>`;

        if ((got0 && got0.balance > 0) || (got1 && got1.balance > 0)) {
          html += `</br><p>You can only care for one beast at a time, they are very demanding creatures. Please take back your payment</p>`;
        }
      }

      return html;
    }
  };

  return {
    version: 1,
    components: [
      {
        type: "building",
        id: "BagBeasts-beast-shop",
        title: "Bag Beasts Beast Shop",
        summary: `Buy Bag Beasts here! We hold a strict policy of only allowing one beast per person as they are very demanding creatures.`,
        content: [
          {
            id: "default",
            type: "inline",
            html: `
            ${getMainText()}
            `,
            buttons: [
              {
                text: "Buy Beast",
                type: "action",
                action: craft,
                disabled: !canCraft,
              },
            ],
          },
        ],
      },
    ],
  };
}

// No atob function in quickJS.
function base64_decode(s) {
  var base64chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  // remove/ignore any characters not in the base64 characters list
  //  or the pad character -- particularly newlines
  s = s.replace(new RegExp("[^" + base64chars.split("") + "=]", "g"), "");

  // replace any incoming padding with a zero pad (the 'A' character is zero)
  var p =
    s.charAt(s.length - 1) == "="
      ? s.charAt(s.length - 2) == "="
        ? "AA"
        : "A"
      : "";
  var r = "";
  s = s.substr(0, s.length - p.length) + p;

  // increment over the length of this encoded string, four characters at a time
  for (var c = 0; c < s.length; c += 4) {
    // each of these four characters represents a 6-bit index in the base64 characters list
    //  which, when concatenated, will give the 24-bit number for the original 3 characters
    var n =
      (base64chars.indexOf(s.charAt(c)) << 18) +
      (base64chars.indexOf(s.charAt(c + 1)) << 12) +
      (base64chars.indexOf(s.charAt(c + 2)) << 6) +
      base64chars.indexOf(s.charAt(c + 3));

    // split the 24-bit number into the original three 8-bit (ASCII) characters
    r += String.fromCharCode((n >>> 16) & 255, (n >>> 8) & 255, n & 255);
  }
  // remove any zero pad that was added to make this a multiple of 24 bits
  return r.substring(0, r.length - p.length);
}

function toHexString(bytes) {
  const hexString = Array.from(bytes, (byte) => {
    return ("0" + (byte & 0xff).toString(16)).slice(-2);
  }).join("");
  return hexString.length > 0 ? "0x" + hexString : "";
}
