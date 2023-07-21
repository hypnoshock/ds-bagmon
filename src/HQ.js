import ds from "downstream";

export default function update({ selected, world }) {
  const { tiles, mobileUnit } = selected || {};
  const selectedTile = tiles && tiles.length === 1 ? tiles[0] : undefined;
  const selectedBuilding = selectedTile?.building;
  const selectedMobileUnit = mobileUnit;

  const expectedOutputs = selectedBuilding?.kind?.outputs || [];
  const out0 = expectedOutputs?.find((slot) => slot.key == 0);
  const beasts = decodeState(out0?.item);
  // const playersBeast = beasts.filter((beast) => beast.bag == selectedMobileUnit.id);

  const getMainText = () => {
    return "<p>Visit the shop and buy an beast</p>";
  };

  return {
    version: 1,
    components: [
      {
        type: "building",
        id: "BagBeasts-HQ",
        title: "Bag Beasts Headquarters",
        summary: `We hold a registry of every Bag Beast in Hexwood. ${beasts.length} beasts registered to date.`,
        content: [],
      },
    ],
  };
}
