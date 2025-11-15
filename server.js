const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

// --- Configurazione Chiavi API ---
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const sendGridApiKey = process.env.SENDGRID_API_KEY; 
const mongoURI = "mongodb+srv://eadshopuser:Harlem_74@eadshop-cluster.vqeyosy.mongodb.net/eadshopdb?appName=eadshop-cluster"; 

// Inizializzazione Servizi
const stripe = require('stripe')(stripeSecretKey);
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(sendGridApiKey);

const app = express();
const port = process.env.PORT || 10000; 

// --- Middleware ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// --- 1. Connessione a MongoDB ---

const connectDB = async () => {
    try {
        const connectionString = process.env.MONGO_URI || mongoURI; 
        await mongoose.connect(connectionString);
        console.log('MongoDB connesso con successo.');
    } catch (error) {
        console.error('Connessione MongoDB fallita:', error.message);
    }
};

connectDB();

// --- 2. Schema e Modello degli Ordini (Mongoose) ---

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
});

const OrderSchema = new mongoose.Schema({
    products: [ProductSchema],
    customerEmail: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    shippingAddress: { type: Object, required: false },
    orderDate: { type: Date, default: Date.now }
});

const Order = mongoose.model('Order', OrderSchema);

// -------------------------------------------------------------
// --- 3. Route per il Caricamento dei Prodotti (FIX DATI) ---
// -------------------------------------------------------------

app.get('/products', (req, res) => {
    // LISTA PRODOTTI ORIGINALE (Con tutti i campi necessari al frontend)
    const items = [
        {
            "id": "prod_canotta",
            "name": "Canotta 10 Elements Camp",
            "price": 2500, // €25.00
            "currency": "eur",
            "image": "immagini/shop/canotta.jpg",
            "options": {
                "taglia": ["XS", "S", "M", "L", "XL", "XXL"],
                "colore": ["bianco", "nero", "grigio"]
            }
        },
        {
            "id": "prod_croptop",
            "name": "Crop Top Donna Elements",
            "price": 2000, // €20.00
            "currency": "eur",
            "image": "immagini/shop/croptopdonnanero.jpg",
            "options": {
                "taglia": ["XS", "S", "M", "L"],
                "colore": ["bianco", "nero", "grigio"]
            }
        }
        // AGGIUNGI QUI TUTTI GLI ALTRI PRODOTTI CHE AVEVI!
    ];
    res.json(items);
});


// -------------------------------------------------------------
// --- 4. Route di Pagamento e Salvataggio Ordini ---
// -------------------------------------------------------------

app.post('/create-payment-intent', async (req, res) => {
    try {
        const { items, totalAmount, customerEmail, shipping } = req.body; 

        // 1. ELABORAZIONE PAGAMENTO CON STRIPE
        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount, 
            currency: 'eur',
            automatic_payment_methods: { enabled: true },
            receipt_email: customerEmail,
        });

        // 2. SALVATAGGIO DELL'ORDINE NEL DATABASE
        const newOrder = new Order({
            products: items.map(item => ({
                name: item.name,
                // Il frontend manda anche la taglia/colore, aggiungiamolo al nome
                quantity: item.quantity, 
                price: item.price
            })),
            customerEmail: customerEmail,
            totalAmount: totalAmount,
            shippingAddress: shipping 
        });

        await newOrder.save();
        console.log('Ordine salvato con ID:', newOrder._id);

        // 3. INVIO EMAIL DI CONFERMA (Logica SendGrid)
        const productsList = items.map(item => `${item.name} (${item.quantity}x @ €${(item.price / 100).toFixed(2)})`).join('\n');
        
        const msg = {
            to: customerEmail,
            from: 'bboyzinko@gmail.com', 
            subject: 'Conferma Ordine ead-shop',
            html: `
                <h1>Grazie per il tuo ordine!</h1>
                <p>Abbiamo ricevuto il tuo pagamento di €${(totalAmount / 100).toFixed(2)} e l'ordine è stato confermato (ID: ${newOrder._id}).</p>
                <h2>Dettagli Ordine:</h2>
                <pre>${productsList}</pre>
                <p>Spediremo a: ${shipping.address.line1}, ${shipping.address.city}, ${shipping.address.postal_code}</p>
            `,
        };
        
        try {
            await sgMail.send(msg);
            console.log(`Email di conferma inviata a: ${customerEmail}`);
        } catch (error) {
            console.error('ERRORE INVIO EMAIL (SendGrid):', error.response.body.errors);
        }

        res.json({ clientSecret: paymentIntent.client_secret });

    } catch (error) {
        console.error('Errore critico nella route di pagamento:', error.message);
        res.status(500).json({ error: 'Errore dal server: impossibile creare l\'intenzione di pagamento.' });
    }
});


// -------------------------------------------------------------
// --- 5. Route Amministrativa per Visualizzare gli Ordini ---
// -------------------------------------------------------------

app.get('/admin/orders', async (req, res) => {
    try {
        const orders = await Order.find().sort({ orderDate: -1 }); 
        res.json(orders);
    } catch (error) {
        console.error('Errore nel recupero degli ordini:', error.message);
        res.status(500).json({ error: 'Impossibile recuperare gli ordini dal database.' });
    }
});


// --- Avvio del Server ---
app.listen(port, () => {
    console.log(`Server attivo sulla porta ${port}`);
});
