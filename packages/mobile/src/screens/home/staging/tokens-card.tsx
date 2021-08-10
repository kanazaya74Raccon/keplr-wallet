import React, { FunctionComponent } from "react";
import { Card, CardBody, CardHeader } from "../../../components/staging/card";
import { View, ViewStyle } from "react-native";
import { observer } from "mobx-react-lite";
import { useStore } from "../../../stores";
import { useStyle } from "../../../styles";
import { TokenItem } from "../../tokens";
import { Button } from "../../../components/staging/button";
import { useSmartNavigation } from "../../../navigation";

export const TokensCard: FunctionComponent<{
  containerStyle?: ViewStyle;
}> = observer(({ containerStyle }) => {
  const { chainStore, queriesStore, accountStore } = useStore();

  const style = useStyle();

  const smartNavigation = useSmartNavigation();

  const queryBalances = queriesStore
    .get(chainStore.current.chainId)
    .queryBalances.getQueryBech32Address(
      accountStore.getAccount(chainStore.current.chainId).bech32Address
    );

  const tokens = queryBalances.positiveNativeUnstakables.concat(
    queryBalances.nonNativeBalances
  );

  return (
    <View style={containerStyle}>
      <Card>
        <CardHeader
          containerStyle={style.flatten(["padding-bottom-card-vertical-half"])}
          title="Token"
        />
        <CardBody
          style={style.flatten([
            "padding-0",
            "padding-bottom-card-vertical-half",
          ])}
        >
          {tokens.map((token) => {
            return (
              <TokenItem
                key={token.currency.coinMinimalDenom}
                currency={token.currency}
                balance={token.balance}
              />
            );
          })}
        </CardBody>
      </Card>
      <Button
        mode="text"
        text="View All Tokens"
        onPress={() => {
          smartNavigation.navigateSmart("Tokens", {});
        }}
      />
    </View>
  );
});
