import React, { FunctionComponent } from "react";
import { StyleSheet, Text, ViewStyle, View } from "react-native";
import { useStyle } from "../../../styles";
import { Bech32Address } from "@keplr-wallet/cosmos";
import Clipboard from "expo-clipboard";
import { RectButton } from "../rect-button";
import { CopyIcon } from "../icon";

export const AddressCopyable: FunctionComponent<{
  style?: ViewStyle;
  address: string;
  maxCharacters: number;
}> = ({ style: propStyle, address, maxCharacters }) => {
  const style = useStyle();

  return (
    <RectButton
      style={StyleSheet.flatten([
        style.flatten([
          "padding-left-12",
          "padding-right-8",
          "padding-y-2",
          "border-radius-12",
          "background-color-primary-10",
          "flex-row",
          "items-center",
        ]),
        propStyle,
      ])}
      onPress={() => {
        Clipboard.setString(address);
      }}
      rippleColor={style.get("color-button-primary-outline-ripple").color}
      underlayColor={style.get("color-button-primary-outline-underlay").color}
      activeOpacity={1}
    >
      <Text style={style.flatten(["subtitle3", "color-primary-400"])}>
        {Bech32Address.shortenAddress(address, maxCharacters)}
      </Text>
      <View style={style.flatten(["margin-left-4"])}>
        <CopyIcon color={style.get("color-primary").color} size={18} />
      </View>
    </RectButton>
  );
};
