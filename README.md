# Bag Beasts - An experimental game (in Downstream)

## Deploy

To deploy the game directly (although we reccomend you follow the instructions above to make it your own first):

1. Choose a number from 1 to 9223372036854775807
   - **Write down this number. You’ll need it if you want to make changes to your building!**

Generating a random number in NodeJS

```
function genRandomNumber(byteCount, radix) {
  return BigInt('0x' + crypto.randomBytes(byteCount).toString('hex')).toString(radix)
}
genRandomNumber(8, 10)
```

2. From the command line type:

```
BUILDING_KIND_EXTENSION_ID=InsertYourID GAME_ADDRESS=0x1D8e3A7Dc250633C192AC1bC9D141E1f95C419AB forge script script/Deploy.sol --broadcast --verify --rpc-url "https://network-ds-test.dev.playmint.com"
```
