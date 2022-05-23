import { useState, useEffect } from 'react';
import { BlockChair } from '../utils/explorer';

export const useTransaction = (network) => {
    const [txList, setTxList] = useState([]);
    const [count, setCount] = useState(0);

    const refresh = () => setCount(count + 1);

    const addTx = (txId) => {
        txList.push({
            txId,
            blocknumber: undefined,
            status: 'unconfirmed',
        });
        setTxList(txList);
        refresh();
    }

    useEffect(() => {
        const explorer = new BlockChair('apiKey', 'Test');
        Promise.all(txList.map((each) => explorer.checkTxStatus(each.txId))).then(
          (data) => {
            const result = data.map((each) => ({
              txId: each.txId,
              blocknumber: each.blockId,
              status: each.blockId ? 'confirmed' : 'unconfirmed',
            }));
    
            setTxList(result);
          },
        );
    // can't set dependency as txList because it'll be circular
    // txList is only ever updated with addTx
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [network, count]);

    return { refresh, txList, addTx };
}