import ds from "downstream";

function decodeState(stateItem) {
  const base64 = stateItem?.name?.value;
  if (!base64) return [];

  const binaryString = base64_decode(base64);

  const stateBytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    stateBytes[i] = binaryString.charCodeAt(i);
  }

  // TODO: Read all 32 bytes. This will currently break after 255 entries
  const numEntries = stateBytes[63];

  //   struct EggEntry {
  //     uint256 index;
  //     bytes24 owner;
  //     EggState state;
  //     uint256 lastFedBlock;
  //     uint256 bornBlock;
  //     uint256 eggNum;
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
      eggNum: Number(
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

  const expectedOutputs = selectedBuilding?.kind?.outputs || [];
  const out0 = expectedOutputs?.find((slot) => slot.key == 0);
  const eggs = decodeState(out0?.item);
  // const playersEgg = eggs.filter((egg) => egg.owner == selectedMobileUnit.id);

  const getMainText = () => {
    return "<p>Visit the shop and buy an egg</p>";
  };

  return {
    version: 1,
    components: [
      {
        type: "building",
        id: "BagBeasts-HQ",
        title: "Bag Beasts Headquarters",
        summary: `We hold a registry of every Bag Beast in Hexwood. ${eggs.length} eggs registered to date.`,
        content: [],
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
