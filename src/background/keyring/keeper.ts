import { Key, KeyRing, KeyRingStatus } from "./keyring";

import {
  AccessOrigin,
  ChainInfo,
  ExtensionAccessOrigins,
  NativeChainInfos
} from "../../chain-info";
import { Address } from "@everett-protocol/cosmosjs/crypto";
import { AsyncApprover } from "../../common/async-approver";
import {
  TxBuilderConfigPrimitive,
  TxBuilderConfigPrimitiveWithChainId
} from "./types";

import { openWindow } from "../../common/window";

const Buffer = require("buffer/").Buffer;

export interface KeyHex {
  algo: string;
  pubKeyHex: string;
  addressHex: string;
  bech32Address: string;
}

interface SignMessage {
  chainId: string;
  message: Uint8Array;
}

export class KeyRingKeeper {
  private readonly keyRing = new KeyRing();
  private path = "";

  private readonly unlockApprover = new AsyncApprover();

  private readonly txBuilderApprover = new AsyncApprover<
    TxBuilderConfigPrimitive
  >(() => {}, true);
  private readonly txBuilerConfigs: Map<
    string,
    TxBuilderConfigPrimitiveWithChainId
  > = new Map();

  private readonly signApprover = new AsyncApprover();
  private readonly signMessages: Map<string, SignMessage> = new Map();

  async enable(): Promise<KeyRingStatus> {
    if (this.keyRing.status === KeyRingStatus.EMPTY) {
      throw new Error("key doesn't exist");
    }

    if (this.keyRing.status === KeyRingStatus.NOTLOADED) {
      await this.keyRing.restore();
    }

    if (this.keyRing.status === KeyRingStatus.LOCKED) {
      openWindow(
        `chrome-extension://${chrome.runtime.id}/popup.html#/?external=true`
      );
      await this.unlockApprover.request("unlock");
      return this.keyRing.status;
    }

    return this.keyRing.status;
  }

  getRegisteredChains(): ChainInfo[] {
    return NativeChainInfos;
  }

  getChainInfo(chainId: string): ChainInfo {
    const chainInfo = this.getRegisteredChains().find(chainInfo => {
      return chainInfo.chainId === chainId;
    });

    if (!chainInfo) {
      throw new Error(`There is no chain info for ${chainId}`);
    }
    return chainInfo;
  }

  getAccessOrigins(): AccessOrigin[] {
    return ExtensionAccessOrigins;
  }

  getAccessOrigin(chainId: string): string[] {
    const accessOrigins = this.getAccessOrigins();
    const accessOrigin = accessOrigins.find(accessOrigin => {
      return accessOrigin.chainId == chainId;
    });

    if (!accessOrigin) {
      throw new Error(`There is no access origins for ${chainId}`);
    }

    return accessOrigin.origins;
  }

  checkAccessOrigin(chainId: string, origin: string) {
    if (origin === `chrome-extension://${chrome.runtime.id}`) {
      return;
    }

    const accessOrigin = this.getAccessOrigin(chainId);
    if (accessOrigin.indexOf(origin) <= -1) {
      throw new Error("This origin is not approved");
    }
  }

  async checkBech32Address(chainId: string, bech32Address: string) {
    const key = await this.getKey();
    if (
      bech32Address !==
      new Address(key.address).toBech32(
        this.getChainInfo(chainId).bech32Config.bech32PrefixAccAddr
      )
    ) {
      throw new Error("Invalid bech32 address");
    }
  }

  async restore(): Promise<KeyRingStatus> {
    await this.keyRing.restore();
    return this.keyRing.status;
  }

  async save(): Promise<void> {
    await this.keyRing.save();
  }

  /**
   * This will clear all key ring data.
   * Make sure to use this only in development env for testing.
   */
  async clear(): Promise<KeyRingStatus> {
    await this.keyRing.clear();
    return this.keyRing.status;
  }

  async createKey(mnemonic: string, password: string): Promise<KeyRingStatus> {
    // TODO: Check mnemonic checksum.
    await this.keyRing.createKey(mnemonic, password);
    return this.keyRing.status;
  }

  lock(): KeyRingStatus {
    this.keyRing.lock();
    return this.keyRing.status;
  }

  async unlock(password: string): Promise<KeyRingStatus> {
    await this.keyRing.unlock(password);
    try {
      this.unlockApprover.approve("unlock");
    } catch {
      // noop
    }
    return this.keyRing.status;
  }

  setPath(chainId: string, account: number, index: number) {
    this.path = this.getChainInfo(chainId).bip44.pathString(account, index);
  }

  async getKey(): Promise<Key> {
    if (!this.path) {
      throw new Error("path not set");
    }

    return this.keyRing.getKey(this.path);
  }

  async requestTxBuilderConfig(
    config: TxBuilderConfigPrimitiveWithChainId,
    openPopup: boolean
  ): Promise<TxBuilderConfigPrimitive> {
    const random = new Uint8Array(4);
    crypto.getRandomValues(random);
    const hash = Buffer.from(random).toString("hex");
    const index = config.chainId;

    this.txBuilerConfigs.set(index, config);

    if (openPopup) {
      // Open fee window with hash to let the fee page to know that window is requested newly.
      openWindow(
        `chrome-extension://${chrome.runtime.id}/popup.html#/fee/${index}?external=true&hash=${hash}`
      );
    }

    const result = await this.txBuilderApprover.request(index);
    this.txBuilerConfigs.delete(index);
    if (!result) {
      throw new Error("config is approved, but result config is null");
    }
    return result;
  }

  getRequestedTxConfig(chainId: string): TxBuilderConfigPrimitiveWithChainId {
    const config = this.txBuilerConfigs.get(chainId);
    if (!config) {
      throw new Error("Unknown config request index");
    }

    return config;
  }

  approveTxBuilderConfig(chainId: string, config: TxBuilderConfigPrimitive) {
    this.txBuilderApprover.approve(chainId, config);
  }

  rejectTxBuilderConfig(chainId: string): void {
    this.txBuilderApprover.reject(chainId);
  }

  async requestSign(
    chainId: string,
    message: Uint8Array,
    index: string,
    openPopup: boolean
  ): Promise<Uint8Array> {
    this.signMessages.set(index, { chainId, message });

    if (openPopup) {
      openWindow(
        `chrome-extension://${chrome.runtime.id}/popup.html#/sign/${index}?external=true`
      );
    }

    await this.signApprover.request(index);
    this.signMessages.delete(index);
    return this.keyRing.sign(this.path, message);
  }

  getRequestedMessage(index: string): SignMessage {
    const message = this.signMessages.get(index);
    if (!message) {
      throw new Error("Unknown sign request index");
    }

    return message;
  }

  approveSign(index: string): void {
    this.signApprover.approve(index);
  }

  rejectSign(index: string): void {
    this.signApprover.reject(index);
  }
}
