import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useState
} from "react";

import classnames from "classnames";
import styleCoinInput from "./coin-input.module.scss";

import { Currency, getCurrencyFromDenom } from "../../../common/currency";
import { Dec } from "@everett-protocol/cosmosjs/common/decimal";
import { Coin } from "@everett-protocol/cosmosjs/common/coin";
import { FormFeedback, FormGroup, Input, InputGroup, Label } from "reactstrap";
import { useTxState } from "../../popup/contexts/tx";
import { DecUtils } from "../../../common/dec-utils";
import { CoinUtils } from "../../../common/coin-utils";
import { Int } from "@everett-protocol/cosmosjs/common/int";

export interface CoinInputProps {
  balanceText?: string;

  className?: string;
  label?: string;
  error?: string;

  disableAllBalance?: boolean;
}

export const CoinInput: FunctionComponent<CoinInputProps> = props => {
  const { balanceText, className, label, error, disableAllBalance } = props;

  const txState = useTxState();

  console.log(txState);

  const [currency, setCurrency] = useState<Currency | undefined>();
  const [step] = useState<string | undefined>("");
  const [balance, setBalance] = useState<Coin | undefined>();

  const [allBalance, setAllBalance] = useState(false);

  const [amount, setAmount] = useState<string>("");

  // Set current currency.
  useEffect(() => {
    // If curreny currency is undefined, or new currencies don't have the matched current currency,
    // set currency as the first of new currencies.
    if (!currency) {
      if (txState.currencies.length > 0) {
        setCurrency(txState.currencies[0]);
      }
    } else {
      const find = txState.currencies.find(c => {
        return c.coinMinimalDenom === currency.coinMinimalDenom;
      });
      if (!find) {
        if (txState.currencies.length > 0) {
          setCurrency(txState.currencies[0]);
        }
      } else {
        setCurrency(find);
      }
    }
  }, [currency, txState.currencies]);

  // When the amount input is changes, set the amount for the tx state.
  useEffect(() => {
    if (currency && amount) {
      const int = new Dec(amount)
        .mulTruncate(DecUtils.getPrecisionDec(currency.coinDecimals))
        .truncate();
      const coin = new Coin(currency.coinMinimalDenom, int);

      // Check that the amount of tx state and new coin input are different.
      // React can't check whether prev value is same as new value because this makes the new pointer of coin instance.
      // So, it will make infinite render loop if there is no check that old and new value are different.
      if (txState.amount?.toString() !== coin.toString()) {
        txState.setAmount(coin);
      }
    } else {
      txState.setAmount(null);
    }
  }, [amount, currency, txState]);

  // Set the current balance of selected currency.
  useEffect(() => {
    if (currency) {
      const balance = txState.balances.find(bal => {
        return bal.denom === currency.coinMinimalDenom;
      });
      setBalance(balance);
    }
  }, [currency, txState.balances]);

  // Set the coin amount if all balance is set.
  useEffect(() => {
    if (allBalance && balance && currency) {
      const fee = txState.fees.find(
        fee => fee.denom === currency.coinMinimalDenom
      );

      const subAmount = balance.amount.sub(fee ? fee.amount : new Int(0));
      const decSubAmount = new Dec(subAmount).quoTruncate(
        DecUtils.getPrecisionDec(currency.coinDecimals)
      );
      setAmount(
        DecUtils.removeTrailingZerosFromDecStr(decSubAmount.toString())
      );
    }
  }, [allBalance, balance, currency, txState.fees, txState.gas]);

  const [inputId] = useState(() => {
    const bytes = new Uint8Array(4);
    crypto.getRandomValues(bytes);
    return `input-${Buffer.from(bytes).toString("hex")}`;
  });

  const toggleAllBalance = useCallback(() => {
    setAllBalance(!allBalance);
  }, [allBalance]);

  return (
    <FormGroup className={className}>
      {label ? (
        <Label
          for={inputId}
          className="form-control-label"
          style={{ width: "100%" }}
        >
          {label}
          {txState.balances && currency && balance && !disableAllBalance ? (
            <div
              className={classnames(
                styleCoinInput.balance,
                styleCoinInput.clickable,
                {
                  [styleCoinInput.clicked]: allBalance
                }
              )}
              onClick={toggleAllBalance}
            >
              {balanceText
                ? // TODO: Can use api in react-intl?
                  `${balanceText}: 
                        ${CoinUtils.coinToTrimmedString(balance, currency)}`
                : `Balance: ${CoinUtils.coinToTrimmedString(
                    balance,
                    currency
                  )}`}
            </div>
          ) : null}
        </Label>
      ) : null}
      <InputGroup
        id={inputId}
        className={classnames(styleCoinInput.selectContainer, {
          disabled: allBalance
        })}
      >
        <Input
          className={classnames(
            "form-control-alternative",
            styleCoinInput.input
          )}
          type="number"
          step={step}
          value={amount}
          onChange={useCallback(e => {
            setAmount(e.target.value);
            e.preventDefault();
          }, [])}
          disabled={allBalance}
          autoComplete="off"
        />
        <Input
          type="select"
          className={classnames(
            "form-control-alternative",
            styleCoinInput.select
          )}
          value={currency ? currency.coinDenom : ""}
          onChange={useCallback(e => {
            const currency = getCurrencyFromDenom(e.target.value);
            setCurrency(currency);
            e.preventDefault();
          }, [])}
          disabled={allBalance || !currency}
        >
          {txState.currencies.map((currency, i) => {
            return (
              <option key={i.toString()} value={currency.coinDenom}>
                {currency.coinDenom}
              </option>
            );
          })}
        </Input>
      </InputGroup>
      {error ? (
        <FormFeedback style={{ display: "block" }}>{error}</FormFeedback>
      ) : null}
    </FormGroup>
  );
};
