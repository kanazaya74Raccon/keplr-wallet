import { computed, makeObservable, override } from "mobx";
import { DenomHelper, KVStore } from "@keplr-wallet/common";
import { ChainGetter } from "../../common";
import { ObservableChainQuery } from "../chain-query";
import { CoinPretty, Int } from "@keplr-wallet/unit";
import { BalanceRegistry, ObservableQueryBalanceInner } from "../balances";
import { Cw20ContractBalance } from "./types";

export class ObservableQueryCw20Balance extends ObservableChainQuery<Cw20ContractBalance> {
  constructor(
    kvStore: KVStore,
    chainId: string,
    chainGetter: ChainGetter,
    protected readonly contractAddress: string,
    protected readonly bech32Address: string
  ) {
    super(
      kvStore,
      chainId,
      chainGetter,
      ''
    );

    this.init();
  }

  protected init(): void {
      const msg = JSON.stringify({
          balance: { address: this.bech32Address },
      });
      const q = Buffer.from(msg).toString("base64");
      const url = `/wasm/v1beta1/contract/${this.contractAddress}/smart/${q}`;
      this.setUrl(url);
  }

  protected canFetch(): boolean {
    return this.contractAddress.length > 0;
  }
}

export class ObservableQueryCw20BalanceInner extends ObservableQueryBalanceInner {
  protected readonly queryCw20Balance: ObservableQueryCw20Balance;

  constructor(
    kvStore: KVStore,
    chainId: string,
    chainGetter: ChainGetter,
    denomHelper: DenomHelper,
    protected readonly bech32Address: string
  ) {
    super(
      kvStore,
      chainId,
      chainGetter,
      // No need to set the url at initial.
      "",
      denomHelper
    );

    makeObservable(this);

    this.queryCw20Balance = new ObservableQueryCw20Balance(
      kvStore,
      chainId,
      chainGetter,
      denomHelper.contractAddress,
      bech32Address
    );
  }

  // This method doesn't have the role because the fetching is actually exeucnted in the `ObservableQueryCw20Balance`.
  protected canFetch(): boolean {
    return false;
  }

  @override
  *fetch() {
    yield this.queryCw20Balance.fetch();
  }

  @computed
  get balance(): CoinPretty {
    const denom = this.denomHelper.denom;

    const chainInfo = this.chainGetter.getChain(this.chainId);
    const currency = chainInfo.currencies.find(
      (cur) => cur.coinMinimalDenom === denom
    );

    // TODO: Infer the currency according to its denom (such if denom is `uatom` -> `Atom` with decimal 6)?
    if (!currency) {
      throw new Error(`Unknown currency: ${denom}`);
    }

    if (
      !this.queryCw20Balance.response ||
      !this.queryCw20Balance.response.data.data?.balance
    ) {
      return new CoinPretty(currency, new Int(0)).ready(false);
    }

    return new CoinPretty(
      currency,
      new Int(this.queryCw20Balance.response.data.data.balance)
    );
  }
}

export class ObservableQueryCw20BalanceRegistry implements BalanceRegistry {
  constructor(
    protected readonly kvStore: KVStore
  ) {}

  getBalanceInner(
    chainId: string,
    chainGetter: ChainGetter,
    bech32Address: string,
    minimalDenom: string
  ): ObservableQueryBalanceInner | undefined {
    const denomHelper = new DenomHelper(minimalDenom);
    if (denomHelper.type === "cw20") {
      return new ObservableQueryCw20BalanceInner(
        this.kvStore,
        chainId,
        chainGetter,
        denomHelper,
        bech32Address
      );
    }
  }
}
