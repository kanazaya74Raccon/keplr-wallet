import { BIP44 } from "@everett-protocol/cosmosjs/core/bip44";
import {
  Bech32Config,
  defaultBech32Config
} from "@everett-protocol/cosmosjs/core/bech32Config";

export interface ChainInfo {
  readonly rpc: string;
  readonly rest: string;
  readonly chainId: string;
  readonly chainName: string;
  readonly coinDenom: string;
  readonly coinMinimalDenom: string;
  readonly coinDecimals: number;
  readonly coinIconUrl: string;
  readonly walletUrl: string;
  readonly bip44: BIP44;
  readonly bech32Config: Bech32Config;
  /**
   * This is used to fetch asset's fiat value from coingecko.
   * You can get id from https://api.coingecko.com/api/v3/coins/list.
   */
  readonly coinGeckoId?: string;
}

export const NativeChainInfos: ChainInfo[] = [
  {
    rpc: "http://localhost",
    rest: "http://localhost:1317",
    chainId: "cosmoshub-2",
    chainName: "Cosmos",
    coinDenom: "ATOM",
    coinMinimalDenom: "uatom",
    coinDecimals: 6,
    coinIconUrl: require("assets/atom-icon.png"),
    walletUrl:
      process.env.NODE_ENV === "production"
        ? ""
        : "http://localhost:8081/#/cosmoshub-2",
    bip44: new BIP44(44, 118, 0),
    bech32Config: defaultBech32Config("cosmos"),
    coinGeckoId: "cosmos"
  },
  {
    rpc: "http://localhost:81",
    rest: "null",
    chainId: "columbus-2",
    chainName: "Terra",
    coinDenom: "LUNA",
    coinMinimalDenom: "uluna",
    coinDecimals: 6,
    coinIconUrl: require("assets/luna-icon.svg"),
    walletUrl:
      process.env.NODE_ENV === "production"
        ? ""
        : "http://localhost:8081/#/columbus-2",
    bip44: new BIP44(44, 330, 0),
    bech32Config: defaultBech32Config("terra"),
    coinGeckoId: "luna"
  }
];

export interface AccessOrigin {
  chainId: string;
  origins: string[];
}

/**
 * This declares which origins can access extension without explicit approval.
 */
export const ExtensionAccessOrigins: AccessOrigin[] = [
  {
    chainId: "cosmoshub-2",
    origins: ["http://localhost:8081"]
  },
  {
    chainId: "columbus-2",
    origins: ["http://localhost:8081"]
  }
];
