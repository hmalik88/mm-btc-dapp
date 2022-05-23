const snapId = 'localhost:http://localhost:3000';

export async function connect(cb) {
  const result = await window.ethereum.request({
    method: 'wallet_enable',
    params: [
      {
        wallet_snap: { [snapId]: {} },
      },
    ],
  });

  if (result) {
    cb();
  }
}

/**
 *
 * get the extened publicKey from btcsnap
 *
 * @param network
 * @returns
 */

export async function getExtendedPublicKey(
  network,
  cb,
) {

  const result = await window.ethereum.request({
    method: 'wallet_invokeSnap',
    params: [
      snapId,
      {
        method: 'btc_getxPubKey',
      },
    ],
  });

  if (cb) {
    cb(result);
  }
}

export async function signPsbt(base64Psbt, network) {
  const networkParams = network === 'main' ? 'main' : 'test';

  try {
    return (await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: [
        snapId,
        {
          method: 'btc_signPsbt',
          params: {
            psbt: base64Psbt,
            network: networkParams,
          },
        },
      ],
    }));
  } catch (err) {
    console.error(err);
    throw new Error('Sign PSBT error');
  }
}
