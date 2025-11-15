import React from "react";
import logo from "/2fiat-topup.png";
import {
  disconnect,
  init,
  launchModal,
  onConnected,
  onConnecting,
  onDisconnected,
} from "@getalby/bitcoin-connect-react";
import type { WebLNProvider } from "@webbtc/webln-types";
import PullToRefresh from "pulltorefreshjs";
import { HamburgerMenu } from "./components/HamburgerMenu";
import { getFiatValue, getFiatBtcRate } from "@getalby/lightning-tools";

type CardDetails = { cardBal: string };

init({
  appName: "2fiat Topup",
  // filters: ["nwc"]
});

function App() {
  const [cardUrl, setCardUrl] = React.useState<string>(
    localStorage.getItem("card_url") || ""
  );
  const [provider, setProvider] = React.useState<WebLNProvider>();
  const [cardDetails, setCardDetails] = React.useState<CardDetails>();
  const [walletBalance, setWalletBalance] = React.useState<number>();
  const [isPaying, setPaying] = React.useState(false);
  const [isLoadingWallet, setLoadingWallet] = React.useState(false);
  const [selectedCurrency, setSelectedCurrency] = React.useState<string>(
    localStorage.getItem("selected_currency") || "USD"
  );

  // format is https://2fiat.com/wallet/XXX/card-details/YYY?provider=VCC
  const cardParts = cardUrl.split("/");
  const userToken = cardParts[cardParts.indexOf("wallet") + 1];
  const cardId = cardParts[cardParts.indexOf("card-details") + 1];

  const [walletFiatValue, setWalletFiatValue] = React.useState(0);
  const [walletUsdValue, setWalletUsdValue] = React.useState(0);
  const [cardFiatValue, setCardFiatValue] = React.useState<number>();

  // Use selectedCurrency if valid (3 letters), otherwise fallback to USD
  const validCurrency =
    selectedCurrency.length === 3 ? selectedCurrency : "USD";

  React.useEffect(() => {
    if (userToken && cardId) {
      (async () => {
        const cardDetailsResponse = await fetch(
          `https://2fiat.com/api/v1/prepaid-cards/details/${cardId}`,
          {
            headers: {
              Authorization: `Bearer ${userToken}`,
            },
          }
        );

        const cardDetails = (await cardDetailsResponse.json()) as CardDetails;
        setCardDetails(cardDetails);
      })();
    }
  }, [cardId, userToken]);

  React.useEffect(() => {
    const unsub = onConnected(async (provider) => {
      setProvider(provider);
      setLoadingWallet(false);
      const balance = await provider.getBalance?.();
      if (balance) {
        setWalletBalance(balance.balance);
      }
    });
    return () => {
      unsub();
    };
  });

  // Update wallet fiat values when balance or currency changes
  React.useEffect(() => {
    if (walletBalance) {
      (async () => {
        try {
          // Always calculate USD value
          const usdValue = await getFiatValue({
            satoshi: walletBalance,
            currency: "USD",
          });
          setWalletUsdValue(usdValue);

          // Calculate valid currency value
          const fiatValue = await getFiatValue({
            satoshi: walletBalance,
            currency: validCurrency,
          });
          setWalletFiatValue(fiatValue);
        } catch (error) {
          console.error("Error calculating wallet fiat value:", error);
          // Fallback to USD values
          const usdValue = await getFiatValue({
            satoshi: walletBalance,
            currency: "USD",
          });
          setWalletFiatValue(usdValue);
          setWalletUsdValue(usdValue);
        }
      })();
    }
  }, [walletBalance, validCurrency]);

  // Update card fiat value when currency changes
  React.useEffect(() => {
    if (cardDetails?.cardBal && validCurrency !== "USD") {
      (async () => {
        try {
          const usdAmount = parseFloat(cardDetails.cardBal);
          const btcRate = await getFiatBtcRate("USD");
          const targetRate = await getFiatBtcRate(validCurrency);
          const convertedValue = (usdAmount / btcRate) * targetRate;
          setCardFiatValue(convertedValue);
        } catch (error) {
          console.error("Error calculating card fiat value:", error);
          setCardFiatValue(undefined);
        }
      })();
    } else {
      setCardFiatValue(undefined);
    }
  }, [cardDetails?.cardBal, validCurrency]);
  React.useEffect(() => {
    const unsub = onDisconnected(() => {
      setProvider(undefined);
      setLoadingWallet(false);
    });
    return () => {
      unsub();
    };
  });

  React.useEffect(() => {
    const unsub = onConnecting(() => {
      setLoadingWallet(true);
    });
    return () => {
      unsub();
    };
  });

  function refresh() {
    window.location.reload();
  }

  React.useEffect(() => {
    PullToRefresh.init({
      mainElement: "body",
      onRefresh() {
        window.location.reload();
      },
    });
  }, []);

  function topup() {
    if (!provider) {
      alert("No wallet connected");
      return;
    }

    const amountText = prompt("Amount in USD, min $10");
    if (!amountText) {
      return;
    }

    (async () => {
      try {
        setPaying(true);
        const topupDetailsResponse = await fetch(
          `https://2fiat.com/api/v1/prepaid-cards/topup/${cardId}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${userToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              topupValue: amountText,
              selectedMethod: "BTC-LN",
            }),
          }
        );
        if (!topupDetailsResponse.ok) {
          throw new Error(
            "Failed to create topup: " + topupDetailsResponse.statusText
          );
        }
        const topupDetails = (await topupDetailsResponse.json()) as {
          id: string;
        };

        // CORS workaround to fetch the invoice :scream:
        // real URL: https://2fiat.com/invoice/status?invoiceId=${invoiceId}&paymentMethodId=BTC-LN
        const topupStatusResponse = await fetch(
          `https://2fiat-topup-proxy.fly.dev/status?invoiceId=${topupDetails.id}`
        );
        const topupStatus = (await topupStatusResponse.json()) as
          | {
              address: string;
            }
          | undefined;

        if (!topupStatusResponse.ok) {
          throw new Error(
            "Failed to request lightning invoice from 2fiat invoice: " +
              topupStatusResponse.statusText
          );
        }

        if (!topupStatus?.address) {
          throw new Error(
            "Could not find address in invoice status response :("
          );
        }

        await provider?.sendPayment(topupStatus.address);

        alert("Topped up 🎉🎊");
        refresh();
      } catch (error) {
        alert("Failed to topup :( " + error);
      }
      setPaying(false);
    })();
  }

  function connectCard() {
    const cardUrl = prompt(
      "Go to My cards -> click on your card (you should see the balance) and paste it here. Your Card URL will be saved in local storage."
    );
    if (!cardUrl) {
      return;
    }
    localStorage.setItem("card_url", cardUrl);
    setCardUrl(cardUrl);
  }

  function disconnectCard() {
    localStorage.removeItem("card_url");
    setCardUrl("");
  }

  function disconnectWallet() {
    disconnect();
  }

  async function connectWallet() {
    launchModal();
  }

  function handleCurrencyChange(currency: string) {
    setSelectedCurrency(currency);
    localStorage.setItem("selected_currency", currency);
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header with hamburger menu */}
      <div className="navbar bg-base-100">
        <div className="flex-1">
          <div className="flex items-center">
            <img src={logo} alt="2fiat Topup logo" width={64} height={64} />
            <h1 className="text-xl font-bold ml-2">2fiat Topup</h1>
          </div>
        </div>
        <div className="flex-none">
          <HamburgerMenu
            isCardConnected={!!cardUrl}
            isWalletConnected={isLoadingWallet || !!provider}
            selectedCurrency={selectedCurrency}
            onDisconnectCard={disconnectCard}
            onDisconnectWallet={disconnectWallet}
            onCurrencyChange={handleCurrencyChange}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-6">
          {/* Balance display cards */}
          {cardUrl && (
            <div className="card bg-primary text-primary-content">
              <div className="card-body">
                <h2 className="card-title">Card Balance</h2>
                {cardDetails?.cardBal ? (
                  <>
                    <p className="text-2xl font-bold">
                      {validCurrency === "USD"
                        ? `$${cardDetails.cardBal}`
                        : `${new Intl.NumberFormat(undefined, {
                            style: "currency",
                            currency: validCurrency,
                          }).format(cardFiatValue || 0)}`}
                    </p>
                    {validCurrency !== "USD" && (
                      <p className="text-lg opacity-80">
                        ${cardDetails.cardBal} USD
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-2xl font-bold">Loading...</p>
                )}
              </div>
            </div>
          )}

          {(walletBalance !== undefined || isLoadingWallet || provider) && (
            <div className="card bg-secondary text-secondary-content">
              <div className="card-body">
                <h2 className="card-title">Wallet Balance</h2>
                <p className="text-2xl font-bold">
                  {walletBalance !== undefined
                    ? `${new Intl.NumberFormat().format(walletBalance)} sats`
                    : "Loading..."}
                </p>
                {walletBalance !== undefined && (
                  <>
                    <p className="text-lg">
                      {new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: validCurrency,
                      }).format(walletFiatValue)}
                    </p>
                    {validCurrency !== "USD" && (
                      <p className="text-sm opacity-80">
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "USD",
                        }).format(walletUsdValue)}{" "}
                        USD
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-4">
            {cardDetails && walletBalance && (
              <button
                className="btn btn-primary btn-lg w-full"
                onClick={topup}
                disabled={isPaying}
              >
                {isPaying ? (
                  <>
                    <span className="loading loading-spinner"></span>
                    Topping up...
                  </>
                ) : (
                  "Topup"
                )}
              </button>
            )}

            {!cardUrl && (
              <button
                className="btn btn-outline btn-lg w-full"
                onClick={connectCard}
              >
                Connect Card
              </button>
            )}

            {!isLoadingWallet && !provider && (
              <button
                className="btn btn-outline btn-lg w-full"
                onClick={connectWallet}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
