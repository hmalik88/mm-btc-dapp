import * as bip32 from 'bip32';
import { payments, networks, Psbt } from 'bitcoinjs-lib';
import { BitcoinNetwork, BitcoinScriptType } from '../interface';
import coinSelect from 'coinselect';
import { BlockChair } from './explorer';


export const networkAndScriptMap = {
  xpub: {
    network: BitcoinNetwork.Main,
    scriptType: BitcoinScriptType.P2PKH,
    config: { private: 0x0488ade4, public: 0x0488b21e },
  },
  xprv: {
    network: BitcoinNetwork.Main,
    scriptType: BitcoinScriptType.P2PKH,
    config: { private: 0x0488ade4, public: 0x0488b21e },
  },
  ypub: {
    network: BitcoinNetwork.Main,
    scriptType: BitcoinScriptType.P2SH,
    config: { private: 0x049d7878, public: 0x049d7cb2 },
  },
  yprv: {
    network: BitcoinNetwork.Main,
    scriptType: BitcoinScriptType.P2SH,
    config: { private: 0x049d7878, public: 0x049d7cb2 },
  },
  zpub: {
    network: BitcoinNetwork.Main,
    scriptType: BitcoinScriptType.P2WPKH,
    config: { private: 0x04b2430c, public: 0x04b24746 },
  },
  zprv: {
    network: BitcoinNetwork.Main,
    scriptType: BitcoinScriptType.P2WPKH,
    config: { private: 0x04b2430c, public: 0x04b24746 },
  },
  tpub: {
    network: BitcoinNetwork.Test,
    scriptType: BitcoinScriptType.P2PKH,
    config: { private: 0x04358394, public: 0x043587cf },
  },
  tprv: {
    network: BitcoinNetwork.Test,
    scriptType: BitcoinScriptType.P2PKH,
    config: { private: 0x04358394, public: 0x043587cf },
  },
  upub: {
    network: BitcoinNetwork.Test,
    scriptType: BitcoinScriptType.P2SH,
    config: { private: 0x044a4e28, public: 0x044a5262 },
  },
  uprv: {
    network: BitcoinNetwork.Test,
    scriptType: BitcoinScriptType.P2SH,
    config: { private: 0x044a4e28, public: 0x044a5262 },
  },
  vpub: {
    network: BitcoinNetwork.Test,
    scriptType: BitcoinScriptType.P2WPKH,
    config: { private: 0x045f18bc, public: 0x045f1cf6 },
  },
  vprv: {
    network: BitcoinNetwork.Test,
    scriptType: BitcoinScriptType.P2WPKH,
    config: { private: 0x045f18bc, public: 0x045f1cf6 },
  },
};

export const deteckNetworkAndScriptType = (extendedPubKey) => {
  const keyPrefix = Object.keys(networkAndScriptMap).find(
    (each) => extendedPubKey.slice(0, 4) === each,
  );

  if (keyPrefix) {
    return networkAndScriptMap[keyPrefix];
  }
  throw new Error('Unknown network or script Type');
};

const caculateBitcoinAddress = (
  pubKey,
  network,
  scriptType,
) => {
  let networkConfig;
  if (network === BitcoinNetwork.Main) {
    networkConfig = networks.bitcoin;
  } else {
    networkConfig = networks.testnet;
  }
  if (scriptType === BitcoinScriptType.P2PKH) {
    const { address } = payments.p2pkh({
      pubkey: pubKey,
      network: networkConfig,
    });
    return address;
  } else if (scriptType === BitcoinScriptType.P2SH) {
    const { address } = payments.p2sh({
      redeem: payments.p2wpkh({
        pubkey: pubKey,
        network: networkConfig,
      }),
      network: networkConfig,
    });
    return address;
  } else if (scriptType === BitcoinScriptType.P2WPKH) {
    const { address } = payments.p2wpkh({
      pubkey: pubKey,
      network: networkConfig,
    });
    return address;
  } else {
    throw new Error('Unknown network or script Type to caculate the address');
  }
};

const batchGenerateAddreses =
  (changeIndex) =>
  (
    node,
    network,
    scriptType,
    fromIndex,
    toIndex,
  ) => {
    let result = [];
    for (let i = fromIndex; i < toIndex; i++) {
      const childNode = node.derive(changeIndex).derive(i);
      result.push({
        address: caculateBitcoinAddress(
          childNode.publicKey,
          network,
          scriptType,
        ),
        path: `m/${changeIndex}/${i}`,
        pubkey: childNode.publicKey,
      });
    }
    return result;
  };

const genreateAddresses =
  (type) =>
  (extendedPubKey, fromIndex = 0, toIndex = 10) => {
    const { node, network, scriptType } = generateNode(extendedPubKey);

    return batchGenerateAddreses(type)(
      node,
      network,
      scriptType,
      fromIndex,
      toIndex,
    );
  };

export const generateReceiveAddress = genreateAddresses(0);
export const generateChangeAddress = genreateAddresses(1);

const generateNode = (extendedPubKey) => {
  const { network, scriptType } = deteckNetworkAndScriptType(extendedPubKey);
  let networkConfig;
  if (network === BitcoinNetwork.Main) {
    networkConfig = networks.bitcoin;
  } else {
    networkConfig = networks.testnet;
  }
  const node = bip32.fromBase58(extendedPubKey, networkConfig);
  return { node, network, scriptType };
};

export const getNodeFingerPrint = (extendedPubKey) => {
  const { node } = generateNode(extendedPubKey);

  return node.fingerprint;
};

const DUST_THRESHOLD = 546;

export const generatePSBT = (
  targetObject,
  utxos,
  feeRate,
  sendInfo,
  network,
) => {
  if (!targetObject.address || !targetObject.value) {
    throw new Error('Target Address or value is empty');
  }

  if (!sendInfo.changeAddress) {
    throw new Error('change address is empty');
  }

  if (targetObject.value <= DUST_THRESHOLD) {
    throw new Error('Dust transaction is not allowed');
  }

  const { inputs, outputs } = selectUtxos(
    targetObject.address,
    targetObject.value,
    feeRate,
    utxos,
  );
  return composePsbt(
    inputs,
    outputs,
    sendInfo.changeAddress,
    sendInfo.addressList,
    sendInfo.masterFingerprint,
    network,
  );
};

const selectUtxos = (
  traget,
  value,
  feeRate,
  utxos,
) => {
  const targetObj = [
    {
      address: traget,
      value: value,
    },
  ];
  const utxoList = utxos.map((each) => {
    const formatedUxto = {
      txId: each.transactionHash,
      vout: each.index,
      value: each.value,
      address: each.address,
    };
    if (each.rawHex) {
      formatedUxto['nonWitnessUtxo'] = Buffer.from(each.rawHex, 'hex');
    }

    return formatedUxto;
  });

  return coinSelect(utxoList, targetObj, feeRate);
};

const findAddress = (address, addressList) => {
  return addressList.find((each) => each.address === address);
};

const composePsbt = (
  inputs,
  outputs,
  changeAddress,
  addressList,
  masterFingerprint,
  network,
) => {
  let networkConfig;
  if (network === BitcoinNetwork.Main) {
    networkConfig = networks.bitcoin;
  } else {
    networkConfig = networks.regtest;
  }

  let psbt = new Psbt({ network: networkConfig });

  if(!inputs) throw new Error('Utxo selections error please retry')

  inputs.forEach((each) => {
    let inputItem = {
      hash: each.txId,
      index: each.vout,
    };
    // BIP 0174 - tx format
    if (each.nonWitnessUtxo) {
      inputItem['nonWitnessUtxo'] = Buffer.from(each.nonWitnessUtxo, 'hex');
    }
    // BIP 0174 - tx format
    const addressItem = findAddress(each.address, addressList);
    if (addressItem) {
      inputItem['bip32Derivation'] = [
        {
          masterFingerprint,
          path: addressItem.path,
          pubkey: addressItem.pubkey,
        },
      ];
    }
    psbt.addInput(inputItem);
  });

  outputs.forEach((output) => {
    if (!output.address) {
      output.address = changeAddress;
    }

    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  });

  return psbt;
};

export const sendTx = async (txhex, network) => {
  const explorer = new BlockChair('apiKey', 'Test');
  return explorer.broadcastTransaction(txhex);
};
