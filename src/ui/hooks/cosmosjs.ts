import { ChainInfo } from "../../chain-info";
import { WalletProvider } from "@everett-protocol/cosmosjs/core/walletProvider";
import { Context } from "@everett-protocol/cosmosjs/core/context";
import { GaiaRest } from "@everett-protocol/cosmosjs/gaia/rest";
import { Codec } from "@node-a-team/ts-amino";
import * as CmnCdc from "@everett-protocol/cosmosjs/common/codec";
import * as Crypto from "@everett-protocol/cosmosjs/crypto";
import * as Bank from "@everett-protocol/cosmosjs/x/bank";
import * as Distr from "@everett-protocol/cosmosjs/x/distribution";
import * as Staking from "@everett-protocol/cosmosjs/x/staking";
import * as Slashing from "@everett-protocol/cosmosjs/x/slashing";
import * as Gov from "@everett-protocol/cosmosjs/x/gov";
import { Rest } from "@everett-protocol/cosmosjs/core/rest";
import { useCallback, useEffect, useState } from "react";
import { Msg } from "@everett-protocol/cosmosjs/core/tx";
import { useBech32ConfigPromise } from "@everett-protocol/cosmosjs/common/address";
import { TxBuilderConfig } from "@everett-protocol/cosmosjs/core/txBuilder";
import { Api } from "@everett-protocol/cosmosjs/core/api";
import { defaultTxEncoder } from "@everett-protocol/cosmosjs/common/stdTx";
import { stdTxBuilder } from "@everett-protocol/cosmosjs/common/stdTxBuilder";
import { Account } from "@everett-protocol/cosmosjs/core/account";
import { queryAccount } from "@everett-protocol/cosmosjs/core/query";

/**
 * useCosmosJS hook returns the object related to cosmosjs api.
 * sendMsgs in returned value can send msgs asynchronously safely.
 * sendMsgs will not make state transition after component unmounted.
 * Make sure to pass the wallet provider as state to avoid re-rendering every time.
 * You can override rest factory or register codec.
 * Also, make sure that you pass rest factory and register codec by using useCallback to avoid re-rendering.
 */
export const useCosmosJS = <R extends Rest = Rest>(
  chainInfo: ChainInfo,
  walletProvider: WalletProvider,
  restFactory?: (context: Context) => R,
  registerCodec?: (codec: Codec) => void
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const memorizedRestFactory = useCallback<(context: Context) => R>(
    restFactory ||
      ((context: Context) => (new GaiaRest(context) as unknown) as R),
    [restFactory]
  );

  const memorizedRegisterCodec = useCallback<(codec: Codec) => void>(
    registerCodec ||
      ((codec: Codec) => {
        CmnCdc.registerCodec(codec);
        Crypto.registerCodec(codec);
        Bank.registerCodec(codec);
        Distr.registerCodec(codec);
        Staking.registerCodec(codec);
        Slashing.registerCodec(codec);
        Gov.registerCodec(codec);
      }),
    [registerCodec]
  );

  type SendMsgs = (
    msgs: Msg[],
    config: TxBuilderConfig,
    onSuccess?: () => void,
    onFail?: (e: Error) => void,
    mode?: "commit" | "sync" | "async"
  ) => Promise<void>;

  const [sendMsgs, setSendMsgs] = useState<SendMsgs | undefined>(undefined);

  useEffect(() => {
    setLoading(false);
    let isSubscribed = true;

    const api = new Api<R>(
      {
        chainId: chainInfo.chainId,
        walletProvider: walletProvider,
        rpc: chainInfo.rpc,
        rest: chainInfo.rest,
        disableGlobalBech32Config: true
      },
      {
        txEncoder: defaultTxEncoder,
        txBuilder: stdTxBuilder,
        restFactory: memorizedRestFactory,
        queryAccount: (
          context: Context,
          address: string | Uint8Array
        ): Promise<Account> => {
          return queryAccount(
            context.get("bech32Config"),
            context.get("rpcInstance"),
            address
          );
        },
        bech32Config: chainInfo.bech32Config,
        bip44: chainInfo.bip44,
        registerCodec: memorizedRegisterCodec
      }
    );

    const _sendMsgs: SendMsgs = async (
      msgs: Msg[],
      config: TxBuilderConfig,
      onSuccess?: () => void,
      onFail?: (e: Error) => void,
      mode: "commit" | "sync" | "async" = "sync"
    ) => {
      if (isSubscribed) {
        setLoading(true);
      }
      try {
        if (api.wallet) {
          await api.enable();

          // eslint-disable-next-line react-hooks/rules-of-hooks
          await useBech32ConfigPromise(
            api.context.get("bech32Config"),
            async () => {
              const result = await api.sendMsgs(msgs, config, mode);

              if (result.mode === "sync" || result.mode === "async") {
                if (result.code !== 0) {
                  throw new Error(result.log);
                }
              } else if (result.mode === "commit") {
                if (result.checkTx.code !== 0) {
                  throw new Error(result.checkTx.log);
                }
                if (result.deliverTx.code !== 0) {
                  throw new Error(result.deliverTx.log);
                }
              }
            }
          );

          if (onSuccess) {
            onSuccess();
          }
        } else {
          throw Error("their is no wallet");
        }
      } catch (e) {
        if (isSubscribed) {
          setError(e);
        }
        if (onFail) {
          onFail(e);
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    };

    setSendMsgs(() => _sendMsgs);

    return () => {
      isSubscribed = false;
    };
  }, [chainInfo, walletProvider, memorizedRestFactory, memorizedRegisterCodec]);

  return {
    loading,
    error,
    sendMsgs
  };
};
