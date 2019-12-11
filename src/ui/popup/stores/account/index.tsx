import { ChainInfo } from "../../../../chain-info";

import { sendMessage } from "../../../../common/message";
import {
  GetKeyMsg,
  KeyRingStatus,
  SetPathMsg
} from "../../../../background/keyring";

import { action, observable } from "mobx";
import { actionAsync, task } from "mobx-utils";

import { BACKGROUND_PORT } from "../../../../common/message/constant";
import { Coin } from "@everett-protocol/cosmosjs/common/coin";

import { queryAccount } from "@everett-protocol/cosmosjs/core/query";
import { RootStore } from "../root";

import Axios, { CancelTokenSource } from "axios";
import { AutoFetchingAssetsInterval } from "../../../../options";

export class AccountStore {
  @observable
  private chainInfo!: ChainInfo;

  @observable
  public isAddressFetching!: boolean;

  @observable
  public bech32Address!: string;

  @observable
  public isAssetFetching!: boolean;

  @observable
  public lastAssetFetchingError: Error | undefined;

  @observable
  public assets!: Coin[];

  @observable
  public bip44Account!: number;

  @observable
  public bip44Index!: number;

  @observable
  public keyRingStatus!: KeyRingStatus;

  // Not need to be observable
  private lastFetchingCancleToken!: CancelTokenSource | undefined;
  // Account store fetchs the assets that the account has for chain by interval.
  // If chain is changed, abort last interval and restart fetching by interval.
  private lastFetchingIntervalId!: NodeJS.Timeout | undefined;

  // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
  // @ts-ignore
  constructor(private readonly rootStore: RootStore) {
    this.init();
  }

  @action
  private init() {
    this.isAddressFetching = true;
    this.bech32Address = "";

    this.isAssetFetching = true;
    this.assets = [];

    this.bip44Account = 0;
    this.bip44Index = 0;

    this.keyRingStatus = KeyRingStatus.NOTLOADED;
  }

  // This will be called by chain store.
  @actionAsync
  public async setChainInfo(info: ChainInfo) {
    this.chainInfo = info;

    if (this.keyRingStatus === KeyRingStatus.UNLOCKED) {
      await task(this.fetchAccount());

      if (this.lastFetchingIntervalId) {
        clearInterval(this.lastFetchingIntervalId);
        this.lastFetchingIntervalId = undefined;
      }

      // Fetch the assets by interval.
      this.lastFetchingIntervalId = setInterval(() => {
        this.fetchAssets();
      }, AutoFetchingAssetsInterval);
    }
  }

  // This will be called by keyring store.
  @actionAsync
  public async setKeyRingStatus(status: KeyRingStatus) {
    this.keyRingStatus = status;

    if (status === KeyRingStatus.UNLOCKED) {
      await task(this.fetchAccount());
    }
  }

  @actionAsync
  public async setBIP44Account(account: number, index: number) {
    this.bip44Account = account;
    this.bip44Index = index;

    await task(this.fetchAccount());
  }

  @actionAsync
  public async fetchAccount() {
    await task(this.fetchBech32Address());
    await task(this.fetchAssets());
  }

  @actionAsync
  private async fetchBech32Address() {
    this.isAddressFetching = true;

    const setPathMsg = SetPathMsg.create(
      this.chainInfo.chainId,
      this.bip44Account,
      this.bip44Index
    );
    await task(sendMessage(BACKGROUND_PORT, setPathMsg));

    // No need to set origin, because this is internal.
    const getKeyMsg = GetKeyMsg.create(this.chainInfo.chainId, "");
    const result = await task(sendMessage(BACKGROUND_PORT, getKeyMsg));

    const prevBech32Address = this.bech32Address;

    this.bech32Address = result.bech32Address;
    this.isAddressFetching = false;

    if (prevBech32Address !== this.bech32Address) {
      // If bech32address is changed.
      // Cancle last fetching, and clear the account's assets.
      if (this.lastFetchingCancleToken) {
        this.lastFetchingCancleToken.cancel();
        this.lastFetchingCancleToken = undefined;
      }

      this.lastAssetFetchingError = undefined;
      this.assets = [];
    }
  }

  /*
   This should be called when isAddressFetching is false.
   */
  @actionAsync
  private async fetchAssets() {
    if (this.isAddressFetching) {
      throw new Error("Address is fetching");
    }

    // If fetching is in progess, abort it.
    if (this.lastFetchingCancleToken) {
      this.lastFetchingCancleToken.cancel();
      this.lastFetchingCancleToken = undefined;
    }
    this.lastFetchingCancleToken = Axios.CancelToken.source();

    this.isAssetFetching = true;

    try {
      const account = await task(
        queryAccount(
          this.chainInfo.bech32Config,
          Axios.create({
            baseURL: this.chainInfo.rpc,
            cancelToken: this.lastFetchingCancleToken.token
          }),
          this.bech32Address
        )
      );

      this.assets = account.getCoins();
    } catch (e) {
      if (!Axios.isCancel(e)) {
        this.assets = [];
        if (
          !e.toString().includes(`account ${this.bech32Address} does not exist`)
        ) {
          this.lastAssetFetchingError = e;
        }
        // Though error occurs, don't clear last fetched assets.
        // Show last fetched assets with warning that error occured.
        console.log(`Error occurs during fetching price: ${e.toString()}`);
      }
    } finally {
      this.lastFetchingCancleToken = undefined;
      this.isAssetFetching = false;
    }
  }
}
