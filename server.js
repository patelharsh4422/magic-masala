const express   = require('express');
const Razorpay  = require('razorpay');
const crypto    = require('crypto');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');
const http     = require('http');
const { Server } = require('socket.io');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB ──────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING_HERE';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// ── WhatsApp (optional) ───────────────────────────────────────
const WA_PHONE  = process.env.WA_PHONE  || '919327815264';
const WA_APIKEY = process.env.WA_APIKEY || '';

async function sendWhatsApp(message) {
  if (!WA_APIKEY) return;
  try {
    const encoded = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${encoded}&apikey=${WA_APIKEY}`;
    await fetch(url);
    console.log('📲 WhatsApp sent!');
  } catch (err) {
    console.log('⚠️  WhatsApp failed:', err.message);
  }
}


// ── Razorpay ─────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id    : process.env.RAZORPAY_KEY_ID     || 'rzp_test_PASTE_YOUR_KEY_HERE',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'PASTE_YOUR_SECRET_HERE'
});

// ── Schemas ──────────────────────────────────────────────────
const Booking = mongoose.model('Booking', new mongoose.Schema({
  name    : { type: String, required: true },
  phone   : { type: String, required: true },
  email   : { type: String, default: '' },
  date    : { type: String, required: true },
  time    : { type: String, required: true },
  guests  : { type: String, required: true },
  special : { type: String, default: '' },
  status  : { type: String, default: 'New' }
}, { timestamps: true }));

const Order = mongoose.model('Order', new mongoose.Schema({
  name    : { type: String, required: true },
  phone   : { type: String, required: true },
  email   : { type: String, default: '' },
  address : { type: String, default: '' },
  items   : { type: String, required: true },
  total   : { type: Number, required: true },
  status    : { type: String, default: 'New' },
  paymentId : { type: String, default: '' }
}, { timestamps: true }));

const Message = mongoose.model('Message', new mongoose.Schema({
  name    : { type: String, required: true },
  message : { type: String, required: true },
  status  : { type: String, default: 'New' }
}, { timestamps: true }));

// ── Socket.io — Real-time ─────────────────────────────────────
io.on('connection', (socket) => {
  console.log('👤 Admin dashboard connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('👤 Admin dashboard disconnected:', socket.id);
  });
});

// ── SERVE ADMIN PAGE ──────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ── BOOKINGS ─────────────────────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, phone, email, date, time, guests, special } = req.body;
    if (!name || !phone || !date || !time || !guests)
      return res.status(400).json({ error: 'Missing required fields' });

    const booking = await Booking.create({ name, phone, email, date, time, guests, special });

    // Broadcast to all admin dashboards instantly
    io.emit('new_booking', booking);

    // WhatsApp notification
    sendWhatsApp(
`🍛 New Table Booking - Magic Masala

👤 Name    : ${name}
📞 Phone   : ${phone}
📅 Date    : ${date}
🕐 Time    : ${time}
👥 Guests  : ${guests}
📝 Special : ${special || 'None'}

✅ Saved to dashboard!`
    );

    res.status(201).json({ success: true, id: booking._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── ORDERS ───────────────────────────────────────────────────
app.post('/api/orders', async (req, res) => {
  try {
    const { name, phone, email, address, items, total } = req.body;
    if (!name || !phone || !items || !total)
      return res.status(400).json({ error: 'Missing required fields' });
    const order = await Order.create({ name, phone, email, address, items, total });

    // Broadcast to admin
    io.emit('new_order', order);

    sendWhatsApp(`🍽️ New Order - Magic Masala\n👤 ${name}\n📞 ${phone}\n🛒 ${items}\n💰 Rs. ${total}`);

    res.status(201).json({ success: true, id: order._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/orders/:id', async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── MESSAGES ─────────────────────────────────────────────────
app.post('/api/messages', async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!name || !message)
      return res.status(400).json({ error: 'Missing required fields' });
    const msg = await Message.create({ name, message });

    // Broadcast to admin
    io.emit('new_message', msg);

    res.status(201).json({ success: true, id: msg._id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── MENU ─────────────────────────────────────────────────────
app.get('/api/menu', (req, res) => {
  let items = MENU;
  const { category, search } = req.query;
  if (category && category !== 'All') items = items.filter(i => i.cat === category);
  if (search) items = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.desc.toLowerCase().includes(search.toLowerCase())
  );
  res.json(items);
});

// ── STATS ─────────────────────────────────────────────────────
app.get('/api/stats', async (req, res) => {
  try {
    const bookings = await Booking.countDocuments();
    const orders   = await Order.countDocuments();
    const messages = await Message.countDocuments();
    const rev      = await Order.aggregate([{ $group: { _id: null, t: { $sum: '$total' } } }]);
    res.json({ bookings, orders, messages, revenue: rev[0]?.t || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// ── SITEMAP ──────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  res.header('Content-Type', 'application/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://magic-masala.onrender.com/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://magic-masala.onrender.com/#menu</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://magic-masala.onrender.com/#book</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://magic-masala.onrender.com/#contact</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
</urlset>`);
});

// ── ROBOTS.TXT ────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://magic-masala.onrender.com/sitemap.xml`);
});


// ── CREATE RAZORPAY ORDER ─────────────────────────────────────
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });

    const order = await razorpay.orders.create({
      amount  : amount * 100,   // Razorpay uses paise (1 Rs = 100 paise)
      currency: 'INR',
      receipt : 'mm_' + Date.now(),
      notes   : { source: 'Magic Masala Website' }
    });

    res.json({
      id    : order.id,
      amount: order.amount,
      key   : process.env.RAZORPAY_KEY_ID || 'rzp_test_PASTE_YOUR_KEY_HERE'
    });
  } catch (err) {
    console.log('❌ Razorpay create order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── VERIFY PAYMENT & SAVE ORDER ───────────────────────────────
app.post('/api/verify-payment', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name, phone, email, address, items, total
    } = req.body;

    // Verify signature — proves payment is genuine
    const secret    = process.env.RAZORPAY_KEY_SECRET || 'PASTE_YOUR_SECRET_HERE';
    const body      = razorpay_order_id + '|' + razorpay_payment_id;
    const expected  = crypto.createHmac('sha256', secret).update(body).digest('hex');

    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature' });
    }

    // Signature verified ✅ — now save order to MongoDB
    const order = await Order.create({
      name, phone, email: email || '', address: address || '',
      items, total,
      status: 'Paid',
      paymentId: razorpay_payment_id
    });

    // Notify admin via WhatsApp
    sendWhatsApp(
`💳 Payment Received - Magic Masala!

👤 Name    : ${name}
📞 Phone   : ${phone}
📍 Address : ${address}
🛒 Items   : ${items}
💰 Amount  : Rs. ${total}
🔖 Txn ID  : ${razorpay_payment_id}

✅ Payment verified & order saved!`
    );

    // Broadcast to admin dashboard
    io.emit('new_order', order);

    res.json({ success: true, orderId: order._id });
  } catch (err) {
    console.log('❌ Payment verify error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── CATCH ALL ─────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ─────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  🍛  Magic Masala Server Started      ║`);
  console.log(`║  🌐  http://localhost:${PORT}             ║`);
  console.log(`║  📊  Admin: /admin                    ║`);
  console.log(`║  ⚡  Real-time: Socket.io ON          ║`);
  console.log('╚══════════════════════════════════════╝\n');
});

// ── ALL VEG MENU DATA ─────────────────────────────────────────
const MENU = [
  { id:1,  name:'Paneer Butter Masala',  cat:'Main Course',    price:280, veg:true, desc:'Rich tomato-cashew gravy with soft paneer cubes',              img:'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80' },
  { id:2,  name:'Dal Makhani',           cat:'Main Course',    price:220, veg:true, desc:'Slow-cooked black lentils in a buttery cream sauce',           img:'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80' },
  { id:3,  name:'Palak Paneer',          cat:'Main Course',    price:260, veg:true, desc:'Creamy spinach curry with fresh cottage cheese cubes',         img:'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=500&q=80' },
  { id:4,  name:'Shahi Paneer',          cat:'Main Course',    price:300, veg:true, desc:'Paneer in rich royal gravy with nuts and cream',               img:'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80' },
  { id:5,  name:'Veg Biryani',           cat:'Rice & Biryani', price:220, veg:true, desc:'Fragrant basmati rice with seasonal vegetables and spices',    img:'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&q=80' },
  { id:6,  name:'Paneer Biryani',        cat:'Rice & Biryani', price:260, veg:true, desc:'Aromatic basmati rice layered with spiced paneer',             img:'https://images.unsplash.com/photo-1563379091339-03246963d96d?w=500&q=80' },
  { id:7,  name:'Jeera Rice',            cat:'Rice & Biryani', price:150, veg:true, desc:'Fragrant cumin flavored steamed basmati rice',                 img:'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&q=80' },
  { id:8,  name:'Garlic Naan',           cat:'Breads',         price:60,  veg:true, desc:'Soft leavened bread topped with garlic and butter',            img:'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80' },
  { id:9,  name:'Butter Naan',           cat:'Breads',         price:50,  veg:true, desc:'Soft fluffy naan brushed with fresh butter',                   img:'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80' },
  { id:10, name:'Tandoori Roti',         cat:'Breads',         price:40,  veg:true, desc:'Whole wheat bread freshly baked in clay oven',                 img:'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80' },
  { id:11, name:'Paratha',               cat:'Breads',         price:55,  veg:true, desc:'Flaky whole wheat flatbread with ghee',                        img:'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80' },
  { id:12, name:'Samosa (2 pcs)',        cat:'Starters',       price:80,  veg:true, desc:'Crispy pastry filled with spiced potatoes and green peas',     img:'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id:13, name:'Paneer Tikka',          cat:'Starters',       price:220, veg:true, desc:'Marinated paneer cubes grilled in tandoor with spices',        img:'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=500&q=80' },
  { id:14, name:'Veg Spring Rolls',      cat:'Starters',       price:140, veg:true, desc:'Crispy rolls filled with fresh vegetables and noodles',        img:'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id:15, name:'Hara Bhara Kabab',      cat:'Starters',       price:160, veg:true, desc:'Spinach and pea patties spiced and pan fried',                 img:'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id:16, name:'Gulab Jamun',           cat:'Desserts',       price:120, veg:true, desc:'Soft milk dumplings soaked in rose-cardamom sugar syrup',      img:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80' },
  { id:17, name:'Rasgulla',              cat:'Desserts',       price:100, veg:true, desc:'Soft spongy chhena balls in light sugar syrup',                img:'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=500&q=80' },
  { id:18, name:'Kheer',                 cat:'Desserts',       price:110, veg:true, desc:'Creamy rice pudding with cardamom, saffron and nuts',          img:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80' },
  { id:19, name:'Mango Lassi',           cat:'Beverages',      price:110, veg:true, desc:'Chilled yogurt drink blended with fresh Alphonso mango',       img:'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' },
  { id:20, name:'Masala Chai',           cat:'Beverages',      price:60,  veg:true, desc:'Classic Indian spiced milk tea with ginger and cardamom',      img:'https://images.unsplash.com/photo-1567922045116-2a00fae2ed03?w=500&q=80' },
  { id:21, name:'Fresh Lime Soda',       cat:'Beverages',      price:80,  veg:true, desc:'Chilled fresh lime with soda, sweet or salted',                img:'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' },
  { id:22, name:'Butter Milk',           cat:'Beverages',      price:70,  veg:true, desc:'Cool spiced chaas with cumin and fresh coriander',             img:'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' },
];
