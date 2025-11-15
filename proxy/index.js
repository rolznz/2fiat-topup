// server.js
// Usage: npm install express
// Run: node server.js
import express from "express";
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/status", async (req, res) => {
  const invoiceId = req.query.invoiceId;
  if (!invoiceId) return res.status(400).send("Missing invoiceId");

  const target = `https://2fiat.com/invoice/status?invoiceId=${invoiceId}&paymentMethodId=BTC-LN`;
  try {
    const r = await fetch(target, {
      headers: {
        Referer: `https://2fiat.com/pay/i/${invoiceId}?view=modal`,
      },
    });
    if (!r.ok) {
      const errText = await r.text().catch(() => "");
      return res
        .status(502)
        .send(`Upstream ${r.status} ${r.statusText}\n${errText}`);
    }
    const body = await r.text();

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.send(body);
  } catch (err) {
    res.status(502).send("Bad Gateway");
  }
});

app.listen(PORT, () => console.log(`Listening on http://0.0.0.0:${PORT}`));
