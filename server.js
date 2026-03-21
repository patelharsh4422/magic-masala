const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MongoDB ─────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING_HERE';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected Successfully!'))
  .catch(err => console.log('❌ MongoDB Error:', err.message));

// ── Schemas ─────────────────────────────────────────────────
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
  name   : { type: String, required: true },
  phone  : { type: String, required: true },
  email  : { type: String, default: '' },
  items  : { type: String, required: true },
  total  : { type: Number, required: true },
  status : { type: String, default: 'New' }
}, { timestamps: true }));

const Message = mongoose.model('Message', new mongoose.Schema({
  name    : { type: String, required: true },
  message : { type: String, required: true },
  status  : { type: String, default: 'New' }
}, { timestamps: true }));

// ── BOOKINGS ─────────────────────────────────────────────────
app.post('/api/bookings', async (req, res) => {
  try {
    const { name, phone, email, date, time, guests, special } = req.body;
    if (!name || !phone || !date || !time || !guests)
      return res.status(400).json({ error: 'Missing required fields' });
    const booking = await Booking.create({ name, phone, email, date, time, guests, special });
    res.status(201).json({ success: true, id: booking._id, message: `Confirmation ID: #${booking._id}` });
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
    const { name, phone, email, items, total } = req.body;
    if (!name || !phone || !items || !total)
      return res.status(400).json({ error: 'Missing required fields' });
    const order = await Order.create({ name, phone, email, items, total });
    res.status(201).json({ success: true, id: order._id, message: `Order ID: #${order._id}` });
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

// ── CATCH ALL ────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── START ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  🍛  Magic Masala Server Started      ║`);
  console.log(`║  🌐  http://localhost:${PORT}             ║`);
  console.log(`║  🔐  Admin: tiny dot (bottom-left)    ║`);
  console.log('╚══════════════════════════════════════╝\n');
});

// ── MENU DATA ────────────────────────────────────────────────
const MENU = [
  { id:1,  name:'Paneer Butter Masala',  cat:'Main Course',    price:280, veg:true,  desc:'Rich tomato-cashew gravy with soft paneer cubes',          img:'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80' },
  { id:2,  name:'Butter Chicken',        cat:'Main Course',    price:320, veg:false, desc:'Tender chicken in creamy tomato-butter sauce',             img:'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=500&q=80' },
  { id:3,  name:'Dal Makhani',           cat:'Main Course',    price:220, veg:true,  desc:'Slow-cooked black lentils in a buttery cream sauce',       img:'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80' },
  { id:4,  name:'Chicken Biryani',       cat:'Rice & Biryani', price:350, veg:false, desc:'Aromatic basmati rice layered with spiced chicken',        img:'https://images.unsplash.com/photo-1563379091339-03246963d96d?w=500&q=80' },
  { id:5,  name:'Veg Biryani',           cat:'Rice & Biryani', price:260, veg:true,  desc:'Fragrant basmati rice with seasonal vegetables',           img:'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&q=80' },
  { id:6,  name:'Garlic Naan',           cat:'Breads',         price:60,  veg:true,  desc:'Soft leavened bread topped with garlic and butter',        img:'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80' },
  { id:7,  name:'Tandoori Roti',         cat:'Breads',         price:40,  veg:true,  desc:'Whole wheat bread freshly baked in clay oven',             img:'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80' },
  { id:8,  name:'Gulab Jamun',           cat:'Desserts',       price:120, veg:true,  desc:'Soft milk dumplings soaked in rose-cardamom sugar syrup',  img:'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80' },
  { id:9,  name:'Mango Lassi',           cat:'Beverages',      price:110, veg:true,  desc:'Chilled yogurt drink blended with fresh Alphonso mango',   img:'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' },
  { id:10, name:'Masala Chai',           cat:'Beverages',      price:60,  veg:true,  desc:'Classic Indian spiced milk tea with ginger and cardamom',  img:'https://images.unsplash.com/photo-1567922045116-2a00fae2ed03?w=500&q=80' },
  { id:11, name:'Samosa (2 pcs)',        cat:'Starters',       price:80,  veg:true,  desc:'Crispy pastry filled with spiced potatoes and green peas', img:'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id:12, name:'Chicken Tikka',         cat:'Starters',       price:280, veg:false, desc:'Juicy chicken marinated in spiced yogurt, chargrilled',    img:'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=500&q=80' },
  { id:13, name:'Palak Paneer',          cat:'Main Course',    price:260, veg:true,  desc:'Creamy spinach curry with fresh cottage cheese cubes',     img:'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=500&q=80' },
  { id:14, name:'Mutton Rogan Josh',     cat:'Main Course',    price:400, veg:false, desc:'Slow-cooked tender mutton in rich Kashmiri spice blend',   img:'https://images.unsplash.com/photo-1574894709920-11b28e7367e3?w=500&q=80' },
  { id:15, name:'Rasgulla',             cat:'Desserts',       price:100, veg:true,  desc:'Soft spongy chhena balls in light sugar syrup',            img:'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=500&q=80' },
];
