# StamPunks Snapshot Tool

## Description
This script is designed to validate StamPunks and create a list of valid assets and mintable punks. It processes a JSON feed of StamPunks, downloads the associated images, and checks them against a local directory of known StamPunks images. The script also verifies the assets on the XChain blockchain.

## Dependencies
- Node.js
- axios
- crypto (built-in)
- fs (built-in)

## Installation
1. Ensure you have Node.js installed.
2. Clone the repository or download the script.
3. Install the required dependencies by running the following command in your terminal/command prompt:

```
npm install
```

## Usage
1. Run the script using the following command:

```
node snapshot.js
```

4. After the script finishes execution, three JSON files will be generated within the folder `output`:
    - `valid-assets.json`: Contains the list of valid StamPunks assets.
    - `mintablePunks.json`: Contains the list of mintable punks.
    - `collection.json`: Contains the JSON used by marketplaces.

## Notes
- The script will cache downloaded images in the `cache` directory. If you want to start from a fresh cache delete this folder. It can take some time to download especially as the stamps feed grows. I will try to update this repo with my cache periodically.
- The script uses the fact that it has run the snapshot in the past to validate punks and uses valid-assets.json to speed up the snapshot. If you want to take a fresh snapshot (modify logic for whatever reason or you dont trust anything Im providing here) just replace the contents of that file with an empty array and it will start from scratch