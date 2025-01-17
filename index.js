const request = require("request");
const notifier = require("node-notifier");
const flatMap = require('array.prototype.flatmap');
const replaceAll = require("string.prototype.replaceall");
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const axios = require("axios").default;

flatMap.shim();
replaceAll.shim();

const { COUNTRIES } = require("./constants");
const args = process.argv.slice(2);

async function sendMessage(message) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`
    const params = { chat_id: CHAT_ID, text: message }
    await axios.get(url, { params: params })
}

let skusForCountry = (countrySkuCodeMacbook, countrySkuCode) => {
  return {
    //[`MLY33${countrySkuCodeMacbook}/A`]: `MACBOOK is present`,
    [`MQ0G3Z${countrySkuCode}/A`]: `iPhone 14 Pro 128GB Deep Purple`,
    [`MQ1F3Z${countrySkuCode}/A`]: `iPhone 14 Pro 256GB Deep Purple`,
    [`MQ293Z${countrySkuCode}/A`]: `iPhone 14 Pro 512GB Deep Purple`,
    [`MPXV3Z${countrySkuCode}/A`]: `iPhone 14 Pro 128GB Space Black`,
    [`MQ0T3Z${countrySkuCode}/A`]: `iPhone 14 Pro 256GB Space Black`,
    [`MQ1M3Z${countrySkuCode}/A`]: `iPhone 14 Pro 512GB Space Black`,
  }
}


let favouritesForCountry = (countrySkuCode) => {
  return [
    `MQ1F3Z${countrySkuCode}/A`,
  ]
}

const control = "MYD92LL/A";
let storeNumber = "R172";
let state = "CO";
let country = "US"

if (args.length > 0) {
  const passedStore = args[0];
  country = (args[1] ? args[1] : "US").toUpperCase();
  if (passedStore.charAt(0) === "R") {
    // All retail store numbers start with R
    storeNumber = passedStore;
    state = null;
  }
}

const countryConfig = COUNTRIES[country];

let storePath = countryConfig["storePath"];
let skuList = skusForCountry(countryConfig["skuCodeMacbook"], countryConfig["skuCode"]);
let favorites = favouritesForCountry(countryConfig["skuCode"]);

const query =
  Object.keys(skuList)
    .map((k, i) => `parts.${i}=${encodeURIComponent(k)}`)
    .join("&") + `&searchNearby=true&store=${storeNumber}`;

let options = {
  method: "GET",
  url: `https://www.apple.com${storePath}/shop/fulfillment-messages?` + query,
};

request(options, function (error, response) {
  if (error) throw new Error(error);

  const body = JSON.parse(response.body);
  const storesArray = body.body.content.pickupMessage.stores;
  let skuCounter = {};
  let hasStoreSearchError = false;
  payload = "";

  payload+='Inventory';
  payload+= "\n";
  payload+='---------';
  payload += "\n";
  console.log('Inventory');
  console.log('---------');
  const statusArray = storesArray
    .flatMap((store) => {
      if (state && state !== store.state) return null;

      const name = store.storeName;
      let productStatus = [];

      for (const [key, value] of Object.entries(skuList)) {
        const product = store.partsAvailability[key];

        if (key === control && hasStoreSearchError !== true) {
          hasStoreSearchError = product.pickupDisplay !== "available";
        } else {
          productStatus.push(`${value}: ${product.pickupDisplay}`);

          if (product.pickupDisplay === "available") {
            console.log(`${value} in stock at ${store.storeName}`);
            payload+=`${value} in stock at ${store.storeName}`;
            payload += "\n";
            let count = skuCounter[key] ? skuCounter[key] : 0;
            count += 1;
            skuCounter[key] = count;
          }
        }
      }

      return {
        name: name,
        products: productStatus,
      };
    })
    .filter((n) => n);

  let hasError = hasStoreSearchError;

  const inventory = Object.entries(skuCounter)
    .map(([key, value]) => `${skuList[key]}: ${value}`)
    .join(" | ");

  console.log('\nInventory counts');
  console.log('----------------');
  console.log(inventory.replaceAll(" | ", "\n"));
  let hasFavourite = Object.keys(skuCounter).some(
    (r) => favorites.indexOf(r) >= 0
  );
  let notificationMessage;

  if (inventory) {
    notificationMessage = `${hasFavourite ? "FOUND FAVOURITE! " : "" }Some models found: ${inventory}`;
    sendMessage(`Some models found `);
    sendMessage(payload);
  } else {
    notificationMessage = "No models found.";
    console.log(statusArray);
    //sendMessage(JSON.stringify(statusArray));
    console.log(notificationMessage);
  }
  const message = hasError ? "Possible error?" : notificationMessage;
  notifier.notify({
    title: "IPhone 14 Found!",
    message: message,
    sond: hasError || inventory,
    timeout: false,
  });

  // Log time at end
  console.log(`\nGenerated: ${new Date().toLocaleString()}`);
});
