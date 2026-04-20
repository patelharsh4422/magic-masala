const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const http = require('http');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { body, param, validationResult } = require('express-validator');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING_HERE';
const ALLOWED_ORIGIN = 'https://magic-masala.onrender.com';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || 'development-session-secret-change-me';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_DISPLAY_NAME = process.env.ADMIN_DISPLAY_NAME || 'Magic Masala Admin';

if (IS_PRODUCTION && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required in production.');
}

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not set. Using a development-only fallback secret.');
}

app.disable('x-powered-by');
app.set('trust proxy', 1);

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    credentials: true
  }
});

const corsOptions = {
  origin(origin, callback) {
    if (!origin || origin === ALLOWED_ORIGIN) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://checkout.razorpay.com',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com',
          'https://omnidim.io',
          'https://web3forms.com'
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://images.unsplash.com',
          'https://www.google-analytics.com',
          'https://www.googletagmanager.com'
        ],
        connectSrc: [
          "'self'",
          ALLOWED_ORIGIN,
          'https://checkout.razorpay.com',
          'https://api.razorpay.com',
          'https://lumberjack.razorpay.com',
          'https://www.google-analytics.com',
          'https://www.googletagmanager.com',
          'https://api.web3forms.com',
          'https://omnidim.io'
        ],
        frameSrc: [
          "'self'",
          'https://checkout.razorpay.com',
          'https://www.googletagmanager.com',
          'https://www.google.com',
          'https://www.google.com/maps'
        ],
        formAction: ["'self'", 'https://api.web3forms.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        upgradeInsecureRequests: IS_PRODUCTION ? [] : null
      }
    }
  })
);

app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Menu data remains public for the customer-facing website.
const MENU = [
  { id: 1, name: 'Paneer Butter Masala', cat: 'Main Course', price: 280, veg: true, desc: 'Rich tomato-cashew gravy with soft paneer cubes', img: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80' },
  { id: 2, name: 'Dal Makhani', cat: 'Main Course', price: 220, veg: true, desc: 'Slow-cooked black lentils in a buttery cream sauce', img: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=500&q=80' },
  { id: 3, name: 'Palak Paneer', cat: 'Main Course', price: 260, veg: true, desc: 'Creamy spinach curry with fresh cottage cheese cubes', img: 'https://images.unsplash.com/photo-1548943487-a2e4e43b4853?w=500&q=80' },
  { id: 4, name: 'Shahi Paneer', cat: 'Main Course', price: 300, veg: true, desc: 'Paneer in rich royal gravy with nuts and cream', img: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=500&q=80' },
  { id: 5, name: 'Veg Biryani', cat: 'Rice & Biryani', price: 220, veg: true, desc: 'Fragrant basmati rice with seasonal vegetables and spices', img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&q=80' },
  { id: 6, name: 'Paneer Biryani', cat: 'Rice & Biryani', price: 260, veg: true, desc: 'Aromatic basmati rice layered with spiced paneer', img: 'https://images.unsplash.com/photo-1563379091339-03246963d96d?w=500&q=80' },
  { id: 7, name: 'Jeera Rice', cat: 'Rice & Biryani', price: 150, veg: true, desc: 'Fragrant cumin flavored steamed basmati rice', img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=500&q=80' },
  { id: 8, name: 'Garlic Naan', cat: 'Breads', price: 60, veg: true, desc: 'Soft leavened bread topped with garlic and butter', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80' },
  { id: 9, name: 'Butter Naan', cat: 'Breads', price: 50, veg: true, desc: 'Soft fluffy naan brushed with fresh butter', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80' },
  { id: 10, name: 'Tandoori Roti', cat: 'Breads', price: 40, veg: true, desc: 'Whole wheat bread freshly baked in clay oven', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=500&q=80' },
  { id: 11, name: 'Paratha', cat: 'Breads', price: 55, veg: true, desc: 'Flaky whole wheat flatbread with ghee', img: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&q=80' },
  { id: 12, name: 'Samosa (2 pcs)', cat: 'Starters', price: 80, veg: true, desc: 'Crispy pastry filled with spiced potatoes and green peas', img: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id: 13, name: 'Paneer Tikka', cat: 'Starters', price: 220, veg: true, desc: 'Marinated paneer cubes grilled in tandoor with spices', img: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=500&q=80' },
  { id: 14, name: 'Veg Spring Rolls', cat: 'Starters', price: 140, veg: true, desc: 'Crispy rolls filled with fresh vegetables and noodles', img: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id: 15, name: 'Hara Bhara Kabab', cat: 'Starters', price: 160, veg: true, desc: 'Spinach and pea patties spiced and pan fried', img: 'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?w=500&q=80' },
  { id: 16, name: 'Gulab Jamun', cat: 'Desserts', price: 120, veg: true, desc: 'Soft milk dumplings soaked in rose-cardamom sugar syrup', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80' },
  { id: 17, name: 'Rasgulla', cat: 'Desserts', price: 100, veg: true, desc: 'Soft spongy chhena balls in light sugar syrup', img: 'https://images.unsplash.com/photo-1610057099431-d73a1c9d2f2f?w=500&q=80' },
  { id: 18, name: 'Kheer', cat: 'Desserts', price: 110, veg: true, desc: 'Creamy rice pudding with cardamom, saffron and nuts', img: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=500&q=80' },
  { id: 19, name: 'Mango Lassi', cat: 'Beverages', price: 110, veg: true, desc: 'Chilled yogurt drink blended with fresh Alphonso mango', img: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' },
  { id: 20, name: 'Masala Chai', cat: 'Beverages', price: 60, veg: true, desc: 'Classic Indian spiced milk tea with ginger and cardamom', img: 'https://images.unsplash.com/photo-1567922045116-2a00fae2ed03?w=500&q=80' },
  { id: 21, name: 'Fresh Lime Soda', cat: 'Beverages', price: 80, veg: true, desc: 'Chilled fresh lime with soda, sweet or salted', img: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' },
  { id: 22, name: 'Butter Milk', cat: 'Beverages', price: 70, veg: true, desc: 'Cool spiced chaas with cumin and fresh coriander', img: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=500&q=80' }
];

const bookingSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    date: { type: String, required: true },
    time: { type: String, required: true },
    guests: { type: Number, required: true, min: 1, max: 20 },
    special: { type: String, default: '' },
    status: { type: String, enum: ['New', 'Done'], default: 'New' }
  },
  { timestamps: true }
);

const orderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    items: { type: String, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['New', 'Paid', 'Done'], default: 'New' },
    paymentId: { type: String, default: '' }
  },
  { timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    message: { type: String, required: true },
    status: { type: String, enum: ['New', 'Done'], default: 'New' }
  },
  { timestamps: true }
);

const adminSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, default: 'Admin' },
    passwordHash: { type: String, required: true }
  },
  { timestamps: true }
);

const Booking = mongoose.model('Booking', bookingSchema);
const Order = mongoose.model('Order', orderSchema);
const Message = mongoose.model('Message', messageSchema);
const AdminUser = mongoose.model('AdminUser', adminSchema);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_PASTE_YOUR_KEY_HERE',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'PASTE_YOUR_SECRET_HERE'
});

const sessionMiddleware = session({
  name: 'mm.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PRODUCTION,
    maxAge: 1000 * 60 * 60 * 8
  }
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStrategy(
    {
      usernameField: 'username',
      passwordField: 'password'
    },
    async (username, password, done) => {
      try {
        const normalizedUsername = String(username || '').trim().toLowerCase();
        const admin = await AdminUser.findOne({ username: normalizedUsername });

        if (!admin) {
          return done(null, false, { message: 'Invalid username or password.' });
        }

        const passwordMatches = await bcrypt.compare(password, admin.passwordHash);

        if (!passwordMatches) {
          return done(null, false, { message: 'Invalid username or password.' });
        }

        return done(null, {
          id: admin.id,
          username: admin.username,
          displayName: admin.displayName
        });
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const admin = await AdminUser.findById(id).lean();

    if (!admin) {
      return done(null, false);
    }

    return done(null, {
      id: admin._id.toString(),
      username: admin.username,
      displayName: admin.displayName
    });
  } catch (error) {
    return done(error);
  }
});

const wrap = (middleware) => (socket, next) => middleware(socket.request, {}, next);

io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));
io.use((socket, next) => {
  if (socket.request.user) {
    return next();
  }

  return next(new Error('Unauthorized'));
});

io.on('connection', (socket) => {
  console.log(`Admin dashboard connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Admin dashboard disconnected: ${socket.id}`);
  });
});

const WA_PHONE = process.env.WA_PHONE || '919327815264';
const WA_APIKEY = process.env.WA_APIKEY || '';
const INDIAN_PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '');
}

function getValidationErrors(req) {
  const result = validationResult(req);

  if (result.isEmpty()) {
    return null;
  }

  return result.array().map(({ path: field, msg }) => ({ field, message: msg }));
}

function validationErrorResponse(req, res, next) {
  const errors = getValidationErrors(req);

  if (!errors) {
    return next();
  }

  return res.status(422).json({ success: false, errors });
}

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  const isApiRequest = req.baseUrl === '/api' || req.originalUrl.startsWith('/api/');

  if (isApiRequest) {
    return res.status(401).json({ success: false, error: 'Authentication required.' });
  }

  return res.redirect('/admin/login');
}

async function sendWhatsApp(message) {
  if (!WA_APIKEY) {
    return;
  }

  try {
    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=${WA_PHONE}&text=${encodedMessage}&apikey=${WA_APIKEY}`;
    await fetch(url);
    console.log('WhatsApp notification sent.');
  } catch (error) {
    console.log('WhatsApp notification failed:', error.message);
  }
}

async function ensureAdminUser() {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    console.warn('ADMIN_USERNAME or ADMIN_PASSWORD is not set. Admin bootstrap skipped.');
    return;
  }

  const username = ADMIN_USERNAME.trim().toLowerCase();
  const existingAdmin = await AdminUser.findOne({ username });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await AdminUser.create({
      username,
      displayName: ADMIN_DISPLAY_NAME,
      passwordHash
    });
    console.log(`Admin user "${username}" created.`);
    return;
  }

  const passwordMatches = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.passwordHash);

  if (!passwordMatches) {
    existingAdmin.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    existingAdmin.displayName = ADMIN_DISPLAY_NAME;
    await existingAdmin.save();
    console.log(`Admin user "${username}" password hash refreshed from environment.`);
  }
}

const loginValidators = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required.')
    .isLength({ max: 64 })
    .withMessage('Username is too long.'),
  body('password')
    .isString()
    .withMessage('Password is required.')
    .notEmpty()
    .withMessage('Password is required.')
];

const bookingValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name is too long.')
    .escape(),
  body('phone')
    .trim()
    .customSanitizer(normalizePhone)
    .matches(INDIAN_PHONE_REGEX)
    .withMessage('Enter a valid Indian mobile number.'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('date')
    .trim()
    .notEmpty()
    .withMessage('Date is required.')
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage('Date must use YYYY-MM-DD format.'),
  body('time')
    .trim()
    .notEmpty()
    .withMessage('Time is required.')
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/)
    .withMessage('Time must use HH:MM format.'),
  body('guests')
    .customSanitizer((value) => {
      const match = String(value || '').match(/\d+/);
      return match ? match[0] : value;
    })
    .isInt({ min: 1, max: 20 })
    .withMessage('Guests must be a number between 1 and 20.')
    .toInt(),
  body('special')
    .optional({ checkFalsy: true })
    .trim()
    .escape()
    .isLength({ max: 500 })
    .withMessage('Special request is too long.')
];

const orderValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name is too long.')
    .escape(),
  body('phone')
    .trim()
    .customSanitizer(normalizePhone)
    .matches(INDIAN_PHONE_REGEX)
    .withMessage('Enter a valid Indian mobile number.'),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('address')
    .optional({ checkFalsy: true })
    .trim()
    .escape()
    .isLength({ max: 300 })
    .withMessage('Address is too long.'),
  body('items')
    .trim()
    .notEmpty()
    .withMessage('Order items are required.')
    .isLength({ max: 2000 })
    .withMessage('Order items payload is too large.')
    .escape(),
  body('total')
    .isFloat({ gt: 0 })
    .withMessage('Total must be a positive number.')
    .toFloat()
];

const messageValidators = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name is too long.')
    .escape(),
  body('email')
    .optional({ checkFalsy: true })
    .trim()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .normalizeEmail(),
  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .customSanitizer(normalizePhone)
    .matches(INDIAN_PHONE_REGEX)
    .withMessage('Enter a valid Indian mobile number.'),
  body('message')
    .trim()
    .notEmpty()
    .withMessage('Message is required.')
    .isLength({ max: 2000 })
    .withMessage('Message is too long.')
    .escape()
];

const createOrderValidators = [
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number.')
    .toFloat()
];

const verifyPaymentValidators = [
  body('razorpay_order_id').trim().notEmpty().withMessage('Razorpay order id is required.'),
  body('razorpay_payment_id').trim().notEmpty().withMessage('Razorpay payment id is required.'),
  body('razorpay_signature').trim().notEmpty().withMessage('Razorpay signature is required.'),
  ...orderValidators
];

const statusValidators = [
  param('id')
    .matches(OBJECT_ID_REGEX)
    .withMessage('Invalid record id.'),
  body('status')
    .trim()
    .isIn(['New', 'Paid', 'Done'])
    .withMessage('Invalid status value.')
];

app.get('/admin/login', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/admin');
  }

  return res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/admin');
  }

  return res.redirect('/admin/login');
});

app.get('/admin/session', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.json({ authenticated: false });
  }

  return res.json({
    authenticated: true,
    user: {
      username: req.user.username,
      displayName: req.user.displayName
    }
  });
});

app.post('/admin/login', loginValidators, validationErrorResponse, (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) {
      return next(error);
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: info?.message || 'Invalid username or password.'
      });
    }

    return req.session.regenerate((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      return req.login(user, (loginError) => {
        if (loginError) {
          return next(loginError);
        }

        return req.session.save((saveError) => {
          if (saveError) {
            return next(saveError);
          }

          return res.json({
            success: true,
            user: {
              username: user.username,
              displayName: user.displayName
            }
          });
        });
      });
    });
  })(req, res, next);
});

app.post('/admin/logout', (req, res, next) => {
  req.logout((logoutError) => {
    if (logoutError) {
      return next(logoutError);
    }

    return req.session.destroy((sessionError) => {
      if (sessionError) {
        return next(sessionError);
      }

      res.clearCookie('mm.sid');
      return res.json({ success: true });
    });
  });
});

app.get('/api/menu', (req, res) => {
  let items = MENU;
  const { category, search } = req.query;

  if (category && category !== 'All') {
    items = items.filter((item) => item.cat === category);
  }

  if (search) {
    const query = String(search).toLowerCase();
    items = items.filter(
      (item) =>
        item.name.toLowerCase().includes(query) || item.desc.toLowerCase().includes(query)
    );
  }

  res.json(items);
});

app.post('/api/bookings', bookingValidators, validationErrorResponse, async (req, res) => {
  try {
    const { name, phone, email = '', date, time, guests, special = '' } = req.body;
    const booking = await Booking.create({ name, phone, email, date, time, guests, special });

    io.emit('new_booking', booking);

    await sendWhatsApp(
      `New Table Booking - Magic Masala\n\nName: ${name}\nPhone: ${phone}\nDate: ${date}\nTime: ${time}\nGuests: ${guests}\nSpecial: ${special || 'None'}\n\nSaved to dashboard.`
    );

    res.status(201).json({ success: true, id: booking._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/orders', orderValidators, validationErrorResponse, async (req, res) => {
  try {
    const { name, phone, email = '', address = '', items, total } = req.body;
    const order = await Order.create({ name, phone, email, address, items, total });

    io.emit('new_order', order);

    await sendWhatsApp(
      `New Order - Magic Masala\nName: ${name}\nPhone: ${phone}\nItems: ${items}\nTotal: Rs. ${total}`
    );

    res.status(201).json({ success: true, id: order._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/messages', messageValidators, validationErrorResponse, async (req, res) => {
  try {
    const { name, email = '', phone = '', message } = req.body;
    const record = await Message.create({ name, email, phone, message });

    io.emit('new_message', record);

    res.status(201).json({ success: true, id: record._id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/create-order', createOrderValidators, validationErrorResponse, async (req, res) => {
  try {
    const { amount } = req.body;
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      receipt: `mm_${Date.now()}`,
      notes: { source: 'Magic Masala Website' }
    });

    res.json({
      id: order.id,
      amount: order.amount,
      key: process.env.RAZORPAY_KEY_ID || 'rzp_test_PASTE_YOUR_KEY_HERE'
    });
  } catch (error) {
    console.log('Razorpay create order error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/verify-payment', verifyPaymentValidators, validationErrorResponse, async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      name,
      phone,
      email = '',
      address = '',
      items,
      total
    } = req.body;

    const secret = process.env.RAZORPAY_KEY_SECRET || 'PASTE_YOUR_SECRET_HERE';
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, error: 'Invalid payment signature.' });
    }

    const order = await Order.create({
      name,
      phone,
      email,
      address,
      items,
      total,
      status: 'Paid',
      paymentId: razorpay_payment_id
    });

    await sendWhatsApp(
      `Payment Received - Magic Masala\n\nName: ${name}\nPhone: ${phone}\nAddress: ${address}\nItems: ${items}\nAmount: Rs. ${total}\nTransaction: ${razorpay_payment_id}\n\nPayment verified and saved.`
    );

    io.emit('new_order', order);

    return res.json({ success: true, orderId: order._id });
  } catch (error) {
    console.log('Payment verification error:', error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Public routes are defined above. Admin-only reads and mutations are protected below.
app.use('/api', ensureAuthenticated);

app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/bookings/:id', statusValidators, validationErrorResponse, async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete(
  '/api/bookings/:id',
  [param('id').matches(OBJECT_ID_REGEX).withMessage('Invalid record id.')],
  validationErrorResponse,
  async (req, res) => {
    try {
      await Booking.findByIdAndDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/orders/:id', statusValidators, validationErrorResponse, async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.params.id, { status: req.body.status });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const messages = await Message.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const bookings = await Booking.countDocuments();
    const orders = await Order.countDocuments();
    const messages = await Message.countDocuments();
    const revenueResult = await Order.aggregate([{ $group: { _id: null, total: { $sum: '$total' } } }]);

    res.json({
      bookings,
      orders,
      messages,
      revenue: revenueResult[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

app.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Sitemap: https://magic-masala.onrender.com/sitemap.xml`);
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error && error.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, error: error.message });
  }

  console.error('Unhandled server error:', error);
  return res.status(500).json({ success: false, error: 'Internal server error.' });
});

async function startServer() {
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB connected successfully.');

  await ensureAdminUser();

  server.listen(PORT, () => {
    console.log(`Magic Masala server running on http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
