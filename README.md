# EAD Shop Server (Node + Stripe - Test)

## Setup locale
1. Copia `.env.example` in `.env` e inserisci le chiavi Stripe di test (sk_test_...).
2. Installa dipendenze:
   npm install
3. Avvia:
   npm start
4. Apri: http://localhost:4242/shop.html

## Deploy su Render
- Crea nuovo Web Service, collega repo o carica lo zip.
- Build command: `npm install`
- Start command: `npm start`
- Aggiungi environment variables su Render:
  - STRIPE_SECRET_KEY (sk_test_...)
  - STRIPE_PUBLISHABLE_KEY (pk_test_...)
  - DOMAIN (es. https://tuo-backend.onrender.com)

## Modificare prodotti
Modifica `data/products.json`. I prezzi sono in centesimi (2500 = €25.00). Metti le immagini in `public/images/`.

## Integrazione con Netlify (sito statico)
Nel tuo `shop.html` ospitato su Netlify, imposta `API_URL` nel file per puntare al backend deployato:
  const API_URL = "https://tuo-backend.onrender.com";
