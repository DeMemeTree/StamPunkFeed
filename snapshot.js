const axios = require("axios");
const crypto = require("crypto");
const fs = require("fs").promises;
const fsSync = require("fs");

var foundJSON = {}
var allInstancesOfaPunk = {};
var tempInstance = {};
let stampsFeed = "https://stampchain.io/stamp.json";

var currentValidPunks = JSON.parse(
  fsSync.readFileSync("valid-assets.json", "utf8")
);

async function downloadImage(url) {
  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const data = Buffer.from(response.data, "binary");
    return data.toString("base64");
  } catch (error) {
    console.error(`Failed to download ${url}: ${error.message}`);
    return null;
  }
}

function hash(data) {
  const hash = crypto.createHash("sha256");
  hash.update(data);
  return hash.digest("hex");
}

async function downloadAndCacheImages(urls, cacheDir, delay) {
  const cache = {};
  for (const url of urls) {
    const cacheFile = `${cacheDir}/${hash(url)}.base64`;
    if (cache[url]) {
      // just return the cache
    } else if (fsSync.existsSync(cacheFile)) {
      cache[url] = await fs.readFile(cacheFile, "utf8");
    } else {
      console.log(`Downloading image for ${url}`);
      const base64 = await downloadImage(url);
      if (base64) {
        cache[url] = base64;
        await fs.writeFile(cacheFile, base64, "utf8");
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return cache;
}

async function processJsonArray(jsonUrl) {
  var returnHashes = [];
  try {
    const response = await axios.get(jsonUrl);
    const dataArray = response.data;
    foundJSON = dataArray
    const stampUrls = dataArray.map((data) => {
      if (data.stamp_url) {
        return data.stamp_url;
      }
      return null;
    });
    const delay = 50;
    const cacheDir = "cache"; // local cache directory
    const base64Cache = await downloadAndCacheImages(
      stampUrls,
      cacheDir,
      delay
    );
    for (const data of dataArray) {
      if (data.stamp_url) {
        const stampUrl = data.stamp_url;
        const base64 = base64Cache[stampUrl];
        returnHashes.push(base64);
      } else {
        returnHashes.push("XXXX");
      }
    }
  } catch (error) {
    console.error(`Failed to process ${jsonUrl}: ${error.message}`);
  }
  return returnHashes;
}

function addToAll(punkId, index) {
  var punkId = String(punkId).padStart(4, "0");
  if (tempInstance[punkId] === undefined) {
    tempInstance[punkId] = [index];
  } else {
    tempInstance[punkId].push(index);
  }
}

function containsStampWithNoSpace(str) {
  let lower = str.toLowerCase();
  return (
    lower.includes("stamp: ") === false && lower.substring(0, 6) === "stamp:"
  );
}

async function main() {
  var newTemp = [];
  tempInstance = {};
  let foundHashes = await processJsonArray(stampsFeed);

  console.log("Called JSON and found feed");

  const imgsDirectory = "./imgs/";
  const imageFiles = [];

  for (let i = 0; i <= 9999; i++) {
    const file = `${imgsDirectory}${i}.png`;
    if (fsSync.existsSync(file)) {
      imageFiles.push(i);
    }
  }

  imageFiles.forEach((i) => {
    const file = `${imgsDirectory}${i}.png`;
    const data = fsSync.readFileSync(file);
    const base64EncodedData = data.toString("base64");
    if (foundHashes.includes(base64EncodedData)) {
      newTemp.push(i);
      for (var index = 0; index < foundHashes.length; index++) {
        if (foundHashes[index] === base64EncodedData) {
          addToAll(i, index);
        }
      }
    }
  });

  allInstancesOfaPunk = tempInstance;

  //
  //  Now that we have all the data we need lets start searching...
  //
  let validAssets = [];
  let mintablePunks = [];
  for (let index = 0; index <= 9999; index++) {
    let id = String(index).padStart(4, "0");
    var punkInstances = allInstancesOfaPunk[id];
    if (punkInstances) {
      punkInstances = punkInstances.map((item) => foundJSON[item].cpid);

      // check the local cache json to see if we have already validated the asset.
      var isValidAsset = false;
      for (var d = 0; d < currentValidPunks.length; d++) {
        if (currentValidPunks[d].punkId === id) {
          validAssets.push(currentValidPunks[d]);
          isValidAsset = true;
          break;
        }
      }
      if (isValidAsset) {
        continue;
      }

      var hasBeenFoundToBeMintable = true;
      console.log("Procesing " + id);
      // asset needs to be validated so we will take all instances of found punks and compare them against locking rules
      for (let instance of punkInstances) {
        let url = `https://xchain.io/api/asset/${instance}`;
        try {
          let response = await axiosRetry(url);
          var asset = response.data;
          asset.punkId = id;

          if (asset.locked && asset.divisible) {
            // if the asset is locked and unrecoverable we will continue onwards and check the other punks in the list.
            continue;
          } else if (
            asset.locked &&
            !asset.divisible &&
            parseInt(asset.supply) === 1 &&
            containsStampWithNoSpace(asset.description)
          ) {
            // found a valid StamPunk
            hasBeenFoundToBeMintable = false;
            validAssets.push(asset);
            break;
          } else if (isASchrödingerPunk(asset)) {
            // This is a valid Schrödinger v1 and we need to not continue onwards.
            hasBeenFoundToBeMintable = false;
            break;
          }
        } catch (error) {
          hasBeenFoundToBeMintable = false;
          console.error(`Error fetching asset ${instance}:`, error);
        }
      }

      if (hasBeenFoundToBeMintable) {
        mintablePunks.push(id);
      }
    }
  }

  console.log("Found: " + validAssets.length + " valid assets");
  let jsonData = JSON.stringify(validAssets, null, 2);
  fsSync.writeFileSync("valid-assets.json", jsonData);
  fsSync.writeFileSync(
    "./output/mintablePunks.json",
    JSON.stringify(mintablePunks)
  );

  var traits = [];

  for (var i = 0; i <= 9999; i++) {
    traits.push(
      JSON.parse(fsSync.readFileSync("./metadata/" + i + ".json")).attributes
    );
  }

  var newJSON = {};
  for (var i = 0; i < validAssets.length; i++) {
    var foundTraits = traits[parseInt(validAssets[i].punkId)];
    var traitArray = [];
    Object.keys(foundTraits).forEach((item) => {
      if (item == "name" || item == "description" || item == "image_url") {
        return;
      }
      traitArray.push(foundTraits[item]);
    });
    let keyVal = validAssets[i].asset;
    let foundId = validAssets[i].punkId;
    newJSON[keyVal] = {
      image:
        "https://www.larvalabs.com/public/images/cryptopunks/punk" +
        foundId +
        ".png",
      project: "StamPunks",
      parent: "STAMPS",
      name: "StamPunk #" + foundId,
      attributes: traitArray,
    };
  }
  fsSync.writeFileSync("./output/collection.json", JSON.stringify(newJSON));
}

function isASchrödingerPunk(asset) {
  //
  //  If the asset is not locked and contains a valid description, other stuff can be corrected before locking
  //
  //  or
  //
  //  If the asset is a valid punk but just has a larger supply then 1, supply can be destroyed to become a v1
  //
  return (
    (asset.locked == false && containsStampWithNoSpace(asset.description)) ||
    (asset.locked &&
      !asset.divisible &&
      parseInt(asset.supply) > 1 &&
      containsStampWithNoSpace(asset.description))
  );
}

async function axiosRetry(url, maxRetries = 3) {
  try {
    const response = await axios.get(url);
    return response;
  } catch (error) {
    if (maxRetries <= 0) {
      return error;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return axiosRetry(url, maxRetries - 1);
    }
  }
};

//
//  Start the snapshot
//
main();
