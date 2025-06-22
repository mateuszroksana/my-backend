const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();  // Ładowanie zmiennych środowiskowych z .env
const AutoIncrement = require('mongoose-sequence')(mongoose);  // Dodanie mongoose-sequence
const axios = require('axios');


const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());  // Pozwól na połączenia między frontendem a backendem
app.use(express.json());  // Umożliwia odbieranie JSON w zapytaniach

// Połączenie z MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Połączono z MongoDB Atlas');
  })
  .catch((err) => {
    console.error('Błąd połączenia z MongoDB:', err.message);
  });


//-----------------------------------------------------------
// Definicja schematów dla herbat

// Definicja schematu dla herbat (teas)
const teaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    category: { type: String, default: 'teas' }  // Dodanie domyślnej kategorii
  });
  
  const Tea = mongoose.model('Tea', teaSchema, 'teas');
  

// Definicja schematu dla herbat ziołowych (herbal-teas)
const herbalTeaSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: String, required: true },
    description: { type: String, required: true },
    imageUrl: { type: String, required: true },
    category: { type: String, default: 'herbal-teas' }  // Dodanie domyślnej kategorii
  });
  
  const HerbalTea = mongoose.model('HerbalTea', herbalTeaSchema, 'herbal-teas');
  

//----------------------------------------------------------------------------------
// ENDPOINTY--------------------------------------------------------------------------

// Endpoint do pobierania produktów herbat (kolekcja 'teas')
app.get('/api/teas', async (req, res) => {
  try {
    console.log('Pobieranie herbat...');
    const data = await Tea.find();

    if (!data || data.length === 0) {
      console.log('Brak danych w bazie');
      return res.status(404).json({ message: 'Brak produktów w bazie danych' });
    }

    console.log('Pobrano herbaty:', data);
    res.json(data);
  } catch (error) {
    console.error('Błąd podczas pobierania herbat:', error.message);
    res.status(500).json({ message: 'Błąd pobierania herbat' });
  }
});

// Endpoint do pobierania herbat ziołowych (kolekcja 'herbal-teas')
app.get('/api/herbal-teas', async (req, res) => {
  try {
    console.log('Pobieranie herbat ziołowych...');
    const data = await HerbalTea.find();

    if (!data || data.length === 0) {
      console.log('Brak danych w bazie');
      return res.status(404).json({ message: 'Brak produktów w bazie danych' });
    }

    console.log('Pobrano herbaty ziołowe:', data);
    res.json(data);
  } catch (error) {
    console.error('Błąd podczas pobierania herbat ziołowych:', error.message);
    res.status(500).json({ message: 'Błąd pobierania herbat ziołowych' });
  }
});


//----------------------------------------------------------------------
// Panel administratora

// Definicja schematu transakcji
const transactionSchema = new mongoose.Schema({
    email: { type: String, required: true },
    customerName: { type: String, required: true },
    address: { type: String, required: true },
    paymentMethod: { type: String, required: true },
    products: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tea' },
      name: String,
      price: String,
      quantity: Number
    }],
    totalCost: { type: String, required: true },
    status: { type: String, default: 'niezrealizowane' },  // Dodajemy status zamówienia
    date: { type: Date, default: Date.now }
  });
  
  const Transaction = mongoose.model('Transaction', transactionSchema, 'orders');  
//powiadomienie push
  async function sendNewProductNotification(product) {
    try {
      await axios.post('https://onesignal.com/api/v1/notifications', {
        app_id: process.env.ONESIGNAL_APP_ID,
        included_segments: ['Subscribed Users'],
        headings: { en: '🆕 Nowy produkt w sklepie!' },
        contents: { en: `${product.name} jest już dostępna w sklepie.` },
        url: 'https://my-react-app-ten-wheat.vercel.app/',
        chrome_web_icon: product.imageUrl
      }, {
        headers: {
          'Authorization': `Basic ${process.env.ONESIGNAL_API_KEY}`,
          'Content-Type': 'application/json',
        }
      });
    } catch (err) {
      console.error('❌ Błąd wysyłania powiadomienia OneSignal:', err.response?.data || err.message);
    }
  }
  

// Dodawanie nowego produktu - Teas i HerbalTeas
app.post('/api/admin/products', async (req, res) => {
  try {
    const { category, name, price, description, imageUrl } = req.body;

    if (!name || !price || !description || !imageUrl || !category) {
      return res.status(400).json({ message: 'Brak wymaganych danych' });
    }

    let newProduct;
    if (category === 'herbal-teas') {
      newProduct = new HerbalTea({ name, price, description, imageUrl, category: 'herbal-teas' });
    } else {
      newProduct = new Tea({ name, price, description, imageUrl, category: 'teas' });
    }

    await newProduct.save();

    // 🔔 Wyślij powiadomienie push
    await sendNewProductNotification(newProduct);

    res.status(201).json({ message: 'Produkt dodany pomyślnie!', product: newProduct });
  } catch (error) {
    console.error('Błąd podczas dodawania produktu:', error);
    res.status(500).json({ message: 'Błąd podczas dodawania produktu' });
  }
});
 

// Aktualizacja produktu
app.put('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category, name, price, description, imageUrl } = req.body;

    let updatedProduct;
    if (category === 'herbal-teas') {
      updatedProduct = await HerbalTea.findByIdAndUpdate(id, { name, price, description, imageUrl }, { new: true });
    } else {
      updatedProduct = await Tea.findByIdAndUpdate(id, { name, price, description, imageUrl }, { new: true });
    }

    if (!updatedProduct) {
      return res.status(404).json({ message: 'Produkt nie znaleziony' });
    }

    res.status(200).json({ message: 'Produkt zaktualizowany pomyślnie!' });
  } catch (error) {
    console.error('Błąd podczas aktualizacji produktu:', error);
    res.status(500).json({ message: 'Błąd podczas aktualizacji produktu' });
  }
});

// Usuwanie produktu
app.delete('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { category } = req.body;

    let deletedProduct;
    if (category === 'herbal-teas') {
      deletedProduct = await HerbalTea.findByIdAndDelete(id);
    } else {
      deletedProduct = await Tea.findByIdAndDelete(id);
    }

    if (!deletedProduct) {
      return res.status(404).json({ message: 'Produkt nie znaleziony' });
    }

    res.status(200).json({ message: 'Produkt usunięty pomyślnie!' });
  } catch (error) {
    console.error('Błąd podczas usuwania produktu:', error.message);
    res.status(500).json({ message: 'Błąd podczas usuwania produktu' });
  }
});

// Endpoint pobierania produktu do edycji
app.get('/api/admin/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Tea.findById(id) || await HerbalTea.findById(id);

    if (!product) {
      return res.status(404).json({ message: 'Produkt nie znaleziony' });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error('Błąd podczas pobierania produktu:', error.message);
    res.status(500).json({ message: 'Błąd podczas ładowania danych produktu' });
  }
});

// Endpoint do składania zamówień
app.post('/api/orders', async (req, res) => {
    try {
      const { email, customerName, address, paymentMethod, products, totalCost } = req.body;
  
      if (!email || !customerName || !address || !products || products.length === 0) {
        return res.status(400).json({ message: 'Brak wymaganych danych zamówienia' });
      }
  
      const newOrder = new Transaction({
        email,
        customerName,
        address,
        paymentMethod,
        products,
        totalCost
      });
  
      await newOrder.save();
      res.status(201).json({ message: 'Zamówienie zostało zapisane pomyślnie!' });
    } catch (error) {
      console.error('Błąd podczas zapisywania zamówienia:', error);
      res.status(500).json({ message: 'Nie udało się zapisać zamówienia' });
    }
  });

  // Definicja schematu użytkownika
const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true }
  });
  
  const User = mongoose.model('User', userSchema, 'users');
  
  // Endpoint logowania
  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      const user = await User.findOne({ username, password });  // W prawdziwych aplikacjach użyj bcrypt do sprawdzania hasła
  
      if (!user) {
        return res.status(401).json({ message: 'Nieprawidłowy login lub hasło' });
      }
  
      // Użytkownik poprawnie zalogowany
      res.status(200).json({ message: 'Zalogowano pomyślnie', username: user.username });
    } catch (error) {
      console.error('Błąd podczas logowania:', error);
      res.status(500).json({ message: 'Błąd serwera podczas logowania' });
    }
  });
  
  // Endpoint do pobierania wszystkich zamówień
app.get('/api/orders', async (req, res) => {
    try {
      const orders = await Transaction.find();  // Pobierz wszystkie zamówienia z kolekcji 'orders'
      res.status(200).json(orders);
    } catch (error) {
      console.error('Błąd podczas pobierania zamówień:', error);
      res.status(500).json({ message: 'Błąd podczas pobierania zamówień' });
    }
  });

  // Endpoint do oznaczania zamówienia jako zrealizowane
app.put('/api/orders/:id/complete', async (req, res) => {
    try {
      const { id } = req.params;
  
      const updatedOrder = await Transaction.findByIdAndUpdate(
        id,
        { status: 'zrealizowane' },
        { new: true }
      );
  
      if (!updatedOrder) {
        return res.status(404).json({ message: 'Zamówienie nie zostało znalezione' });
      }
  
      res.status(200).json({ message: 'Zamówienie zostało oznaczone jako zrealizowane', order: updatedOrder });
    } catch (error) {
      console.error('Błąd podczas aktualizacji zamówienia:', error);
      res.status(500).json({ message: 'Błąd serwera podczas aktualizacji zamówienia' });
    }
  });  

// Uruchomienie serwera
app.listen(port, () => {
  console.log(`Serwer działa na porcie ${port}`);
});
