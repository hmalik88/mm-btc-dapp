export const countUtxo = (utxos) => {
  const map = {};
  utxos.forEach((each) => {
    if (map[each.address]) {
      map[each.address] = map[each.address] + 1;
    } else {
      map[each.address] = 1;
    }
  });

  return map;
};

export const addressAggrator = (
  receiveList,
  changeList,
  utxoMap,
) => {
  const addresses = [];
  const allAddress = receiveList.concat(changeList);
  allAddress.forEach((each) => {
    if (each.address) {
      addresses.push({
        address: each.address,
        path: each.path,
        count: utxoMap[each.address] || 0,
      });
    }
  });
  return addresses;
};

export const satoshiToBTC = (satoshi) => {
  return satoshi / (10 ** 8);
};

export const btcToSatoshi = (btc) => {
  if (btc) {
    return Math.round(btc * (10 ** 8));
  }
};
