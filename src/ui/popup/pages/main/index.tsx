import React, { FunctionComponent, useEffect, useRef, useState } from "react";

import { HeaderLayout } from "../../layouts";

import { Card, CardBody, Modal, ModalBody } from "reactstrap";

import style from "./style.module.scss";
import { Menu } from "./menu";
import { AccountView } from "./account";
import { TxButtonView } from "./tx-button";
import { AssetView } from "./asset";
import { StakeView } from "./stake";

import classnames from "classnames";
import { useHistory } from "react-router";
import { observer } from "mobx-react";
import { useStore } from "../../stores";
import { useConfirm } from "../../../components/confirm";
import { useIntl } from "react-intl";
import { TokensView } from "./token";
import { Int } from "@chainapsis/cosmosjs/common/int";
import { ChainUpdaterKeeper } from "../../../../background/updater/keeper";
import { sendMessage } from "../../../../common/message/send";
import { GetKeyStoreBIP44SelectablesMsg } from "../../../../background/keyring";
import { BACKGROUND_PORT } from "../../../../common/message/constant";
import { ChainInfo } from "../../../../background/chains";
import { BIP44 } from "@chainapsis/cosmosjs/core/bip44";
import { useLoadingIndicator } from "../../../components/loading-indicator";
import { shortenAddress } from "../../../../common/address";

const useBIP44Select = (chainInfo: ChainInfo, coinTypeExist: boolean) => {
  const [selectableAccounts, setSelectableAccounts] = useState<
    {
      readonly path: BIP44;
      readonly bech32Address: string;
      readonly isExistent: boolean;
    }[]
  >([]);

  const prevChainId = useRef<string | undefined>();
  useEffect(() => {
    let isMounted = true;

    if (coinTypeExist) {
      setSelectableAccounts([]);
    }

    if (prevChainId.current !== chainInfo.chainId) {
      setSelectableAccounts([]);
      if (!coinTypeExist) {
        (async () => {
          const selectables = await sendMessage(
            BACKGROUND_PORT,
            new GetKeyStoreBIP44SelectablesMsg(chainInfo.chainId, [
              chainInfo.bip44,
              ...(chainInfo.alternativeBIP44s ?? [])
            ])
          );

          if (isMounted) {
            setSelectableAccounts(selectables);
          }
        })();
      }
    }

    prevChainId.current = chainInfo.chainId;

    return () => {
      isMounted = false;
    };
  }, [
    chainInfo.alternativeBIP44s,
    chainInfo.bip44,
    chainInfo.chainId,
    coinTypeExist
  ]);

  return {
    selectableAccounts
  };
};

export const MainPage: FunctionComponent = observer(() => {
  const history = useHistory();
  const intl = useIntl();

  const { chainStore, accountStore, keyRingStore } = useStore();

  const selectedKeyStore = keyRingStore.multiKeyStoreInfo.find(
    keyStore => keyStore.selected
  );
  const coinTypeExist =
    selectedKeyStore == null ||
    selectedKeyStore.coinTypeForChain[
      ChainUpdaterKeeper.getChainVersion(chainStore.chainInfo.chainId)
        .identifier
    ] !== undefined;

  const [needSelectCoinType, setNeedSelectCoinType] = useState(false);
  const alternativeBIP44Exist =
    chainStore.chainInfo.alternativeBIP44s &&
    chainStore.chainInfo.alternativeBIP44s.length > 0;
  const { selectableAccounts } = useBIP44Select(
    chainStore.chainInfo,
    coinTypeExist
  );

  const loading = useLoadingIndicator();

  useEffect(() => {
    if (
      !coinTypeExist &&
      selectableAccounts.length === 0 &&
      alternativeBIP44Exist
    ) {
      loading.setIsLoading("select-bip44", true);
    } else {
      loading.setIsLoading("select-bip44", false);
    }
  }, [
    alternativeBIP44Exist,
    coinTypeExist,
    loading,
    selectableAccounts.length
  ]);

  useEffect(() => {
    if (!coinTypeExist && !alternativeBIP44Exist) {
      keyRingStore.setKeyStoreCoinType(
        chainStore.chainInfo.chainId,
        chainStore.chainInfo.bip44.coinType
      );
    }
  }, [
    alternativeBIP44Exist,
    chainStore.chainInfo.bip44.coinType,
    chainStore.chainInfo.chainId,
    coinTypeExist,
    keyRingStore
  ]);

  useEffect(() => {
    if (!coinTypeExist && selectableAccounts.length > 0) {
      let accounts = selectableAccounts.slice();

      // Remove the account that has main bip44's coin type.
      accounts = accounts.filter(
        account => account.path.coinType !== chainStore.chainInfo.bip44.coinType
      );

      // If no other accounts exist on the chain,
      if (!accounts.find(account => account.isExistent)) {
        // Select the coin type in main bip44.
        keyRingStore.setKeyStoreCoinType(
          chainStore.chainInfo.chainId,
          chainStore.chainInfo.bip44.coinType
        );
      } else {
        setNeedSelectCoinType(true);
      }
    }
  }, [
    chainStore.chainInfo.bip44.coinType,
    chainStore.chainInfo.chainId,
    coinTypeExist,
    keyRingStore,
    selectableAccounts
  ]);

  const confirm = useConfirm();

  const prevChainId = useRef<string | undefined>();
  useEffect(() => {
    if (prevChainId.current !== chainStore.chainInfo.chainId) {
      // FIXME: This will be executed twice on initial because chain store set the chain info on constructor and init.
      (async () => {
        if (await ChainUpdaterKeeper.checkChainUpdate(chainStore.chainInfo)) {
          // If chain info has been changed, warning the user wether update the chain or not.
          if (
            await confirm.confirm({
              paragraph: intl.formatMessage({
                id: "main.update-chain.confirm.paragraph"
              }),
              yes: intl.formatMessage({
                id: "main.update-chain.confirm.yes"
              }),
              no: intl.formatMessage({
                id: "main.update-chain.confirm.no"
              })
            })
          ) {
            await chainStore.tryUpdateChain(chainStore.chainInfo.chainId);
          }
        }
      })();
    }

    prevChainId.current = chainStore.chainInfo.chainId;
  }, [chainStore, chainStore.chainInfo, confirm, intl]);

  const stakeCurrency = chainStore.chainInfo.stakeCurrency;

  const tokens = accountStore.assets.filter(asset => {
    return (
      asset.denom !== stakeCurrency.coinMinimalDenom &&
      asset.amount.gt(new Int(0))
    );
  });

  const hasTokens = tokens.length > 0;

  return (
    <HeaderLayout
      showChainName
      canChangeChainInfo
      menuRenderer={<Menu />}
      rightRenderer={
        <div
          style={{
            height: "64px",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            paddingRight: "20px"
          }}
        >
          <i
            className="fas fa-user"
            style={{
              cursor: "pointer",
              padding: "4px"
            }}
            onClick={e => {
              e.preventDefault();

              history.push("/setting/set-keyring");
            }}
          />
        </div>
      }
    >
      <Modal
        isOpen={needSelectCoinType && selectableAccounts.length > 0}
        centered
      >
        <ModalBody>
          <div>
            {selectableAccounts.map(selectable => {
              return (
                <div
                  key={selectable.bech32Address}
                  style={{ cursor: "pointer" }}
                  onClick={async e => {
                    e.preventDefault();
                    e.stopPropagation();

                    await keyRingStore.setKeyStoreCoinType(
                      chainStore.chainInfo.chainId,
                      selectable.path.coinType
                    );
                  }}
                >
                  {shortenAddress(selectable.bech32Address, 32)}
                </div>
              );
            })}
          </div>
        </ModalBody>
      </Modal>
      <Card className={classnames(style.card, "shadow")}>
        <CardBody>
          <div className={style.containerAccountInner}>
            <AccountView />
            <AssetView />
            <TxButtonView />
          </div>
        </CardBody>
      </Card>
      {chainStore.chainInfo.walletUrlForStaking ? (
        <Card className={classnames(style.card, "shadow")}>
          <CardBody>
            <StakeView />
          </CardBody>
        </Card>
      ) : null}
      {hasTokens ? (
        <Card className={classnames(style.card, "shadow")}>
          <CardBody>
            <TokensView tokens={tokens} />
          </CardBody>
        </Card>
      ) : null}
    </HeaderLayout>
  );
});
