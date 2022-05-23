import * as bip32 from 'bip32';
import { deteckNetworkAndScriptType, networkAndScriptMap } from './index';

export class BlockChair {
  constructor(apiKey, network) {
    this.apiKey = apiKey;
    this.host = 'https://api.blockchair.com';
    this.network = network;
  }

  genereateHost() {
    return this.network === BitcoinNetwork.Test
      ? `${this.host}/bitcoin/testnet`
      : `${this.host}/bitcoin`;
  }

  extractUtxo(response) {
    return Object.values(response.data)[0]['utxo'].map((each) => ({
      address: each.address,
      transactionHash: each.transaction_hash,
      index: each.index,
      value: each.value,
    }));
  }

  processAddressStatus(response) {
    const allPaths = Object.values(
      Object.values(response.data)[0]['addresses'],
    ).map((each) => each.path);
    let recieveMax = 0;
    let changeMax = 0;
    allPaths.forEach((each) => {
      let [type, indexNumber] = each.split('/').map((path) => parseInt(path));
      if (type === 0 && indexNumber > recieveMax) {
        recieveMax = indexNumber;
      } else if (type === 1 && indexNumber > changeMax) {
        changeMax = indexNumber;
      }
    });

    return [recieveMax, changeMax];
  }

  transferNode(
    extendedPubKey,
    prefix,
    config,
  ) {
    const node = bip32.fromBase58(extendedPubKey, { bip32: config, wif: 0 });
    let mainConfig = networkAndScriptMap[prefix]['config'];
    const transferNode = bip32.fromPublicKey(node.publicKey, node.chainCode, {
      bip32: mainConfig,
      wif: 0,
    });
    return transferNode.toBase58();
  }

  convertPubKeyFormate(extendedPubKey) {
    const { network, scriptType, config } =
      deteckNetworkAndScriptType(extendedPubKey);
    if (network === BitcoinNetwork.Test) {
      if (scriptType === BitcoinScriptType.P2PKH) {
        return this.transferNode(extendedPubKey, 'xpub', config);
      } else if (scriptType === BitcoinScriptType.P2SH) {
        return this.transferNode(extendedPubKey, 'ypub', config);
      } else {
        return this.transferNode(extendedPubKey, 'zpub', config);
      }
    } else {
      return extendedPubKey;
    }
  }

  async getStatus(extendedPubKey, includeHex = false) {
    const convertedPubKey = this.convertPubKeyFormate(extendedPubKey);

    const host = `${this.genereateHost()}/dashboards/xpub/${convertedPubKey}`;
    const url = new URL(host);
    const params = { limit: '5000', key: this.apiKey };
    url.search = new URLSearchParams(params).toString();
    const resp = await fetch(url.toString());
    if (!resp.ok) {
      // process error logic for 404 return []
      if (resp.status === 404) {
        return { utxos: [], recieveMax: 0, changeMax: 0 };
      } else {
        throw new Error('fetch utxo data error');
      }
    }

    const responseJson = await resp.json();
    if (responseJson.data.length === 0) {
      return { utxos: [], recieveMax: 0, changeMax: 0 };
    }
    const [recieveMax, changeMax] = this.processAddressStatus(responseJson);
    const utxoList = this.extractUtxo(responseJson);
    if (includeHex) {
      const utxoListWithHex = [];
      for (let each of utxoList) {
        const { txHex } = await this.getTransaction(each.transactionHash);
        utxoListWithHex.push({ ...each, rawHex: txHex });
      }
      return { utxos: utxoListWithHex, recieveMax, changeMax };
    }
    return { utxos: utxoList, recieveMax, changeMax };
  }

  async getTransaction(
    transactionHash,
  ) {
    const host = `${this.genereateHost()}/raw/transaction/${transactionHash}`;
    const url = new URL(host);
    const resp = await fetch(url.toString());

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error('tx not found');
      } else {
        throw new Error('fetch tx data error');
      }
    }

    const responseJson = (await resp.json());
    const txHex = responseJson['data'][transactionHash]['raw_transaction'];
    const blockId = String(responseJson['context']['state']);
    return {
      txId: transactionHash,
      txHex,
      blockId,
    };
  }

  async getSuggestFeeRate() {
    const host = `${this.genereateHost()}/stats`;
    const url = new URL(host);
    const resp = await fetch(url.toString());

    if (!resp.ok) {
      throw new Error('fetch bitcoin transaction data error');
    }

    const responseJson = await resp.json();
    return responseJson['data']['suggested_transaction_fee_per_byte_sat'];
  }

  async broadcastTransaction(transaction) {
    const formData = new FormData();
    formData.append('data', transaction);
    const host = `${this.genereateHost()}/push/transaction`;
    const url = new URL(host);
    const resp = await fetch(url.toString(), {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) {
      throw new Error('fetch bitcoin transaction data error');
    }

    const responseJson = await resp.json();
    return responseJson['data']['transaction_hash'];
  }

  async checkTxStatus(transactionHash) {
    const host = `${this.genereateHost()}/dashboards/transaction/${transactionHash}`;
    const url = new URL(host);
    const resp = await fetch(url.toString());

    if (!resp.ok) {
      if (resp.status === 404) {
        throw new Error('tx not found');
      } else {
        throw new Error('fetch tx data error');
      }
    }

    const responseJson = (await resp.json());
    const blockNumber = responseJson['data'][transactionHash]['transaction']['block_id'];
    
    return {
      txId: transactionHash,
      blockId: blockNumber > 0 ? blockNumber : undefined,
    };
  }
}
