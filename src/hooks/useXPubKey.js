import { useState, useEffect } from 'react';
import { generateReceiveAddress, generateChangeAddress } from '../lib';
import { BlockChair } from '../utils/explorer';

export const useExtendedPubKey = (
  extendedPubKey,
  network,
) => {
  const [pubKey, setPubKey] = useState(extendedPubKey);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const [utxoList, setUTXOList] = useState([]);
  const [recieveAddressList, setRecieveList] = useState([]);
  const [changeAddressList, setChangeList] = useState([]);

  const refresh = () => {
    setCount(count + 1);
  };

  useEffect(() => {
    if (pubKey.length > 0) {
      const explorer = new BlockChair('apiKey', 'Test');
      setLoading(true);
      explorer
        .getStatus(pubKey, true)
        .then((data) => {
          setLoading(false);
          setUTXOList(data.utxos);
          setRecieveList(
            generateReceiveAddress(pubKey, 0, data.recieveMax + 1),
          );
          setChangeList(generateChangeAddress(pubKey, 0, data.changeMax + 1));
        })
        .catch((e) => {
          console.error(e);
          setLoading(false);
        });
    }
  }, [pubKey, count]);

  useEffect(() => {
    setUTXOList([]);
    setRecieveList([]);
    setChangeList([]);
  }, [network]);

  return {
    utxoList,
    recieveAddressList,
    changeAddressList,
    setPubKey,
    refresh,
    loading,
    pubKey,
  };
};
