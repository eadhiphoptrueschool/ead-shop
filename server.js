require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const stripeLib = require('stripe');
const cors = require('cors'); 
const sgMail = require('@sendgrid/mail'); // <-- SendGrid incluso

const app = express();
const PORT = process.env.PORT || 4242;

// Inizializzazione API con chiavi segrete dalle variabili d'ambiente
const stripe = stripeLib(process.env.STRIPE_SECRET_KEY || '');
sgMail.setApiKey(process.env.SENDGRID_API_KEY || ''); 

// --- CONFIGURAZIONE BASE ---
app.use(express.json());
app.use(cors({
    origin: '*', // Permette chiamate da qualsiasi dominio per i test (in produzione, specificare il dominio frontend)
    methods: ['GET', 'POST']
}));
app.use(express.static(path.join(__dirname, 'public')));

// Funzione per caricare i dati dei prodotti
function loadProducts(){
  const raw = fs.readFileSync(path.join(__dirname, 'data', 'products.json'));
  return JSON.parse(raw);
}

// --- ROTTA API PRODOTTI ---
app.get('/products', (req, res) => {
  res.json(loadProducts());
});

// --- FUNZIONE HELPER: INVIO EMAIL CON SENDGRID ---
async function sendOrderConfirmation(customerEmail, orderId, total) {
    // ⚠️ SOSTITUISCI 'confirmed@tuodominio.it' con un indirizzo email VERIFICATO su SendGrid!
    const msg = {
        to: customerEmail,
        from: 'bboyzinko@gmail.com', 
        subject: `Conferma Ordine EAD Shop #${orderId}`,
        html: `
            <h1>Grazie per il tuo ordine!</h1>
            <p>Il tuo pagamento di <b>€ ${(total / 100).toFixed(2)}</b> è stato completato con successo.</p>
            <p>I dettagli dell'ordine saranno inviati separatamente. ID Transazione Stripe: ${orderId}</p>
        `,
    };

    try {
        await sgMail.send(msg);
        console.log(`Email di conferma inviata a: ${customerEmail}`);
    } catch (error) {
        console.error('ERRORE INVIO EMAIL:', error);
    }
}


// --- ROTTA 1: CREAZIONE PAYMENT INTENT (STRIPE) ---
app.post('/create-payment-intent', async (req, res) => {
    try {
        // Riceve l'email dal frontend per salvarla nei metadati Stripe
        const { items, totalAmount, customerEmail } = req.body; 
        
        if (!items || !Array.isArray(items) || items.length === 0 || !customerEmail) {
            return res.status(400).json({ error: 'Dati carrello o email mancanti.' });
        }
        
        const finalAmount = totalAmount; 
        
        if (finalAmount < 50) { 
            return res.status(400).json({ error: "L'importo minimo è 0.50 EUR." });
        }

        const orderId = 'EAD-' + Date.now(); // ID Ordine univoco per il tracking

        const paymentIntent = await stripe.paymentIntents.create({
            amount: finalAmount, 
            currency: 'eur',
            metadata: {
                order_id: orderId,
                customer_email: customerEmail 
            },
        });

        // Restituisce la chiave di conferma Stripe e l'ID Ordine al frontend
        res.json({ clientSecret: paymentIntent.client_secret, orderId: orderId }); 

    } catch (err) {
        console.error("Errore nel Payment Intent:", err);
        res.status(500).json({ error: err.message });
    }
});


// --- ROTTA 2: INVIO CONFERMA ORDINE (SENDGRID) ---
// Chiamata dal frontend DOPO la conferma di pagamento Stripe
app.post('/send-order-confirmation', async (req, res) => {
    try {
        const { orderId, total, customerEmail } = req.body;

        if (!orderId || !total || !customerEmail) {
            return res.status(400).json({ success: false, message: "Dati mancanti per la conferma email." });
        }

        // Esegue l'invio email tramite la funzione helper
        await sendOrderConfirmation(customerEmail, orderId, total);

        // Risponde con successo (non blocca il frontend anche se fallisce l'invio)
        res.json({ success: true, message: "Email di conferma richiesta con successo." });

    } catch (err) {
        console.error("Errore invio email endpoint:", err);
        res.status(500).json({ success: false, message: "Errore nell'invio della mail." }); 
    }
});


app.listen(PORT, () => console.log('Server avviato su port', PORT));
