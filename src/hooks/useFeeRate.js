import { useState, useEffect } from 'react';
import { BlockChair } from '../utils/explorer';

export const useFeeRate = (network) => {
    const [feeRate, setFeeRate] = useState(0);
    const [count, setCount] = useState(0);

    const refresh = () => setCount(count + 1);
    useEffect(() => {
        const explorer = new BlockChair('apiKey', 'Test');
        
        explorer.getSuggestFeeRate().then(setFeeRate)
    }, [network, count]);

    return { feeRate, refresh } ;
}