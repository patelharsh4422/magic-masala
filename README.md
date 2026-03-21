# 🍛 Magic Masala — Node.js Full Stack Restaurant Website

## 📁 Project Structure

```
magicmasala/
├── server.js          ← Node.js + Express backend
├── package.json       ← Dependencies
├── database/
│   └── magicmasala.db ← SQLite DB (auto-created on first run)
└── public/
    └── index.html     ← Frontend (served by Express)
```

---

## 🚀 How to Run (Step by Step)

### Step 1 — Install Node.js
Download from: https://nodejs.org  (choose LTS version)

### Step 2 — Open Terminal in project folder
```
cd magicmasala
```

### Step 3 — Install packages
```
npm install
```

### Step 4 — Start the server
```
node server.js
```

### Step 5 — Open in browser
```
http://localhost:3000
```

---

## 🔑 Secret Admin Panel

There is a **tiny invisible dot** in the **bottom-left corner** of the website.  
Click it to open the **Owner Dashboard** showing:
- 📅 All Table Bookings (Name, Phone, Date, Time, Guests, Special Requests)
- 🍽️ All Orders (Items, Total Amount, Customer Details)
- ✉️ All Messages
- 📊 Stats (Total Bookings, Orders, Messages, Revenue)

---

## 🌐 REST API Endpoints

| Method | Endpoint          | Description           |
|--------|-------------------|-----------------------|
| POST   | /api/bookings     | Create table booking  |
| GET    | /api/bookings     | Get all bookings      |
| PATCH  | /api/bookings/:id | Update booking status |
| DELETE | /api/bookings/:id | Delete booking        |
| POST   | /api/orders       | Place an order        |
| GET    | /api/orders       | Get all orders        |
| PATCH  | /api/orders/:id   | Update order status   |
| POST   | /api/messages     | Send a message        |
| GET    | /api/messages     | Get all messages      |
| GET    | /api/menu         | Get menu items        |
| GET    | /api/stats        | Get dashboard stats   |

---

## 🗄️ Database Tables

**bookings** — id, name, phone, email, date, time, guests, special, status, created_at  
**orders** — id, name, phone, email, items, total, status, created_at  
**messages** — id, name, message, status, created_at  

---

## 🌍 Deploy for Free

### Render.com (easiest)
1. Push to GitHub
2. Go to render.com → New Web Service
3. Build command: `npm install`
4. Start command: `node server.js`
5. Done! 🎉

### Railway.app
1. Push to GitHub
2. Connect repo on railway.app
3. Auto-detects Node.js → deploys automatically

---

## 🎨 Tech Stack
- **Backend**: Node.js + Express.js
- **Database**: SQLite (via better-sqlite3)
- **Frontend**: Vanilla HTML + CSS + JavaScript
- **Fonts**: Dancing Script, Playfair Display, Inter
