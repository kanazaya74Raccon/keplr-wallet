import React, { FunctionComponent, useEffect, useState } from "react";
import { PageWithView } from "../../components/page";
import { useStyle } from "../../styles";
import { View, Text } from "react-native";
import { Button } from "../../components/button";
import { useSmartNavigation } from "../../navigation";
import { RouteProp, useRoute } from "@react-navigation/native";
import { observer } from "mobx-react-lite";
import { useStore } from "../../stores";
import { Toggle } from "../../components/toggle";

export const RegisterEndScreen: FunctionComponent = observer(() => {
  const { keychainStore, keyRingStore } = useStore();

  const style = useStyle();

  const smartNavigation = useSmartNavigation();

  const route = useRoute<
    RouteProp<
      Record<
        string,
        {
          password?: string;
        }
      >,
      string
    >
  >();

  const password = route.params?.password;

  const [isBiometricOn, setIsBiometricOn] = useState(false);

  useEffect(() => {
    if (password && keychainStore.isBiometrySupported) {
      setIsBiometricOn(true);
    }
  }, [keychainStore.isBiometrySupported, password]);

  const [isLoading, setIsLoading] = useState(false);

  return (
    <PageWithView style={style.flatten(["padding-x-42"])}>
      <View style={style.get("flex-2")} />
      <View style={style.flatten(["flex-4"])}>
        <Text
          style={style.flatten([
            "h2",
            "color-text-black-medium",
            "margin-bottom-20",
          ])}
        >
          You’re all set!
        </Text>
        <Text style={style.flatten(["subtitle1", "color-text-black-low"])}>
          Your cosmic interchain journey now begins.
        </Text>
      </View>
      <View style={style.get("flex-1")} />
      {password && keychainStore.isBiometrySupported ? (
        <View
          style={style.flatten([
            "flex-row",
            "margin-bottom-48",
            "items-center",
          ])}
        >
          <Text style={style.flatten(["subtitle1", "color-text-black-medium"])}>
            Enable Biometric
          </Text>
          <View style={style.get("flex-1")} />
          <Toggle
            on={isBiometricOn}
            onChange={(value) => setIsBiometricOn(value)}
          />
        </View>
      ) : null}
      <Button
        size="large"
        text="Done"
        loading={isLoading}
        onPress={async () => {
          setIsLoading(true);
          try {
            if (password && isBiometricOn) {
              await keychainStore.turnOnBiometry(password);
            }

            // Definetly, the last key is newest keyring.
            if (keyRingStore.multiKeyStoreInfo.length > 0) {
              await keyRingStore.changeKeyRing(
                keyRingStore.multiKeyStoreInfo.length - 1
              );
            }

            smartNavigation.reset({
              index: 0,
              routes: [
                {
                  name: "MainTabDrawer",
                },
              ],
            });
          } catch (e) {
            console.log(e);
            setIsLoading(false);
          }
        }}
      />
      <View style={style.get("flex-2")} />
    </PageWithView>
  );
});
