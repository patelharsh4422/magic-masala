// ============================================================
//  Magic Masala Restaurant — Node.js + Express + JSON Database
//  NO extra build tools needed!
//  Run:  npm install  →  node server.js
//  Open: http://localhost:3000
// ============================================================

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── JSON Database Setup ─────────────────────────────────────
const DB_FILE = path.join(__dirname, 'database', 'data.json');

// Create database folder and file if not exists
if (!fs.existsSync(path.join(__dirname, 'database'))) {
  fs.mkdirSync(path.join(__dirname, 'database'));
}
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({
    bookings: [],
    orders:   [],
    messages: []
  }, null, 2));
}

// Read database
function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

// Write database
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Get current time
function now() {
  return new Date().toLocaleString('en-IN', {
    day:    '2-digit',
    month:  'short',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

console.log('✅ JSON Database ready — data.json');

// ══════════════════════════════════════════════════════════
//  BOOKINGS API
// ══════════════════════════════════════════════════════════

// Create booking
app.post('/api/bookings', (req, res) => {
  const { name, phone, email, date, time, guests, special } = req.body;

  if (!name || !phone || !date || !time || !guests) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db      = readDB();
  const newItem = {
    id         : Date.now(),
    name, phone,
    email      : email   || '',
    date, time, guests,
    special    : special || '',
    status     : 'New',
    created_at : now()
  };

  db.bookings.unshift(newItem);
  writeDB(db);

  res.status(201).json({
    success : true,
    id      : newItem.id,
    message : `Confirmation ID: #${newItem.id}`
  });
});

// Get all bookings
app.get('/api/bookings', (req, res) => {
  res.json(readDB().bookings);
});

// Update booking status
app.patch('/api/bookings/:id', (req, res) => {
  const db   = readDB();
  const item = db.bookings.find(b => b.id == req.params.id);
  if (item) item.status = req.body.status;
  writeDB(db);
  res.json({ success: true });
});

// Delete booking
app.delete('/api/bookings/:id', (req, res) => {
  const db       = readDB();
  db.bookings    = db.bookings.filter(b => b.id != req.params.id);
  writeDB(db);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  ORDERS API
// ══════════════════════════════════════════════════════════

// Place order
app.post('/api/orders', (req, res) => {
  const { name, phone, email, items, total } = req.body;

  if (!name || !phone || !items || !total) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db      = readDB();
  const newItem = {
    id         : Date.now(),
    name, phone,
    email      : email || '',
    items, total,
    status     : 'New',
    created_at : now()
  };

  db.orders.unshift(newItem);
  writeDB(db);

  res.status(201).json({
    success : true,
    id      : newItem.id,
    message : `Order ID: #${newItem.id}`
  });
});

// Get all orders
app.get('/api/orders', (req, res) => {
  res.json(readDB().orders);
});

// Update order status
app.patch('/api/orders/:id', (req, res) => {
  const db   = readDB();
  const item = db.orders.find(o => o.id == req.params.id);
  if (item) item.status = req.body.status;
  writeDB(db);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════
//  MESSAGES API
// ══════════════════════════════════════════════════════════

// Send message
app.post('/api/messages', (req, res) => {
  const { name, message } = req.body;

  if (!name || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db      = readDB();
  const newItem = {
    id         : Date.now(),
    name, message,
    status     : 'New',
    created_at : now()
  };

  db.messages.unshift(newItem);
  writeDB(db);

  res.status(201).json({ success: true, id: newItem.id });
});

// Get all messages
app.get('/api/messages', (req, res) => {
  res.json(readDB().messages);
});

// ══════════════════════════════════════════════════════════
//  MENU API
// ══════════════════════════════════════════════════════════

app.get('/api/menu', (req, res) => {
  let items = MENU_DATA;
  const { category, search } = req.query;
  if (category && category !== 'All') items = items.filter(i => i.cat === category);
  if (search) items = items.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.desc.toLowerCase().includes(search.toLowerCase())
  );
  res.json(items);
});

// ══════════════════════════════════════════════════════════
//  STATS API
// ══════════════════════════════════════════════════════════

app.get('/api/stats', (req, res) => {
  const db      = readDB();
  const revenue = db.orders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  res.json({
    bookings : db.bookings.length,
    orders   : db.orders.length,
    messages : db.messages.length,
    revenue
  });
});

// ── Catch-all ───────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Start ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║  🍛  Magic Masala Server Started      ║`);
  console.log(`║  🌐  http://localhost:${PORT}             ║`);
  console.log(`║  🔐  Admin: tiny dot (bottom-left)    ║`);
  console.log('╚══════════════════════════════════════╝\n');
});

// ══════════════════════════════════════════════════════════
//  MENU DATA
// ══════════════════════════════════════════════════════════

const MENU_DATA = [
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
  { id:15, name:'Rasgulla',              cat:'Desserts',       price:100, veg:true,  desc:'Soft spongy chhena balls in light sugar syrup',            img:'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=500&q=80' },
];
