require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const stripeLib = require('stripe');
const app = express();
const PORT = process.env.PORT || 4242;
const DOMAIN = process.env.DOMAIN || ('http://localhost:' + PORT);
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY || '');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function loadProducts(){
  const raw = fs.readFileSync(path.join(__dirname, 'data', 'products.json'));
  return JSON.parse(raw);
}

app.get('/products', (req, res) => {
  res.json(loadProducts());
});

app.post('/create-checkout-session', async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Nessun prodotto selezionato' });
    }
    const products = loadProducts();
    const line_items = items.map(it => {
      const prod = products.find(p => p.id === it.id);
      if (!prod) throw new Error('Prodotto non trovato: ' + it.id);
      return {
        price_data: {
          currency: prod.currency,
          product_data: { name: prod.name, images: [ DOMAIN + prod.image ] },
          unit_amount: prod.price
        },
        quantity: it.quantity || 1
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items,
      success_url: DOMAIN + '/success.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: DOMAIN + '/cancel.html'
    });

    res.json({ url: session.url, id: session.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log('Server avviato su port', PORT));
