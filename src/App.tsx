import React from "react";
import logo from "/2fiat-topup.png";
import {
  disconnect,
  init,
  launchModal,
  onConnected,
  onDisconnected,
} from "@getalby/bitcoin-connect-react";
import type { WebLNProvider } from "@webbtc/webln-types";

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

  // format is https://2fiat.com/wallet/XXX/card-details/YYY?provider=VCC
  const cardParts = cardUrl.split("/");
  const userToken = cardParts[cardParts.indexOf("wallet") + 1];
  const cardId = cardParts[cardParts.indexOf("card-details") + 1];

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
      const balance = await provider.getBalance?.();
      if (balance) {
        setWalletBalance(balance.balance);
      }
    });
    return () => {
      unsub();
    };
  });
  React.useEffect(() => {
    const unsub = onDisconnected(() => {
      setProvider(undefined);
    });
    return () => {
      unsub();
    };
  });

  function refresh() {
    window.location.reload();
  }

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

  return (
    <>
      <div>
        <img src={logo} alt="Vite logo" width={128} />
      </div>
      {cardDetails && <p>Card balance: ${cardDetails.cardBal}</p>}
      {walletBalance !== undefined && (
        <p>Wallet balance: {walletBalance} sats</p>
      )}
      <div>
        {cardDetails && walletBalance && (
          <>
            <button onClick={refresh}>Refresh</button>
            <br />
            <button onClick={topup} disabled={isPaying}>
              {isPaying ? "Topping up..." : "Topup"}
            </button>
            <br />
          </>
        )}
        {!cardUrl && <button onClick={connectCard}>Connect Card</button>}
        {cardUrl && <button onClick={disconnectCard}>Disconnect Card</button>}
        <br />
        {!provider && <button onClick={connectWallet}>Connect Wallet</button>}
        {provider && (
          <button onClick={disconnectWallet}>Disconnect Wallet</button>
        )}
      </div>
    </>
  );
}

export default App;
