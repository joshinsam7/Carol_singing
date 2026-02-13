# Carol Tracker

A real-time web application for tracking and coordinating Christmas caroling trips. Track your caroling bus/vehicle location, manage stops, notify families of arrival times, and coordinate the caroling event with an interactive map interface.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Features](#features)
- [Design Decisions](#design-decisions)
- [Components & Relationships](#components--relationships)
- [Installation](#installation)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [OwnTracks Mobile Integration](#owntracks-mobile-integration)
- [Usage](#usage)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Development](#development)
- [Deployment](#deployment)

---

## Project Overview

**Carol Tracker** is a full-stack application designed for coordinating Christmas caroling events. It allows organizers to:

- Track a caroling bus or vehicle in real-time on an interactive map
- Manage caroling stops (addresses, families, notes)
- Record arrival and departure times at each stop
- View the next stop and destination
- Send location updates from mobile phones using OwnTracks
- Administer the event through a secure admin interface

The application consists of a **Node.js/Express backend** with a **SQLite database** and a **React frontend** with interactive mapping via Leaflet.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • BusMap - Leaflet map visualization                │   │
│  │ • Admin - Stop & family management                  │   │
│  │ • Summary - Next stop information                   │   │
│  │ • Information - Caroling details & schedule         │   │
│  │ • Header - Navigation & UI controls                 │   │
│  └──────────────────────────────────────────────────────┘   │
│  WebSocket Connection & REST API                           │
└─────────────────────────────────────────────────────────────┘
             ↕ WebSocket & CORS (HTTP/HTTPS)
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Node.js/Express)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • API Endpoints - Bus location, stops, events       │   │
│  │ • WebSocket Server - Real-time broadcasts           │   │
│  │ • Business Logic - Trip management, routing         │   │
│  │ • OwnTracks Webhook - Mobile GPS integration        │   │
│  └──────────────────────────────────────────────────────┘   │
│  SQLite Database (better-sqlite3)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • bus_info table - Current bus state & location     │   │
│  │ • stops table - All caroling stops & family data    │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
             ↕ OwnTracks Mobile App
┌─────────────────────────────────────────────────────────────┐
│          OwnTracks (Mobile Location Tracking)               │
│  Sends GPS coordinates from mobile phone to backend         │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

- ✅ **Real-Time Bus Tracking** - Live GPS updates on interactive Leaflet map
- ✅ **Stop Management** - Add, edit, delete, and reorder caroling stops
- ✅ **Family Registry** - Associate families/churches with stops
- ✅ **Arrival/Departure Tracking** - Record timestamps for each stop
- ✅ **Admin Dashboard** - Secure, token-protected admin interface
- ✅ **Responsive UI** - Works on desktop, tablet, and mobile
- ✅ **WebSocket Broadcasting** - Instant updates to all connected clients
- ✅ **Trip Simulation** - Test mode for development and dry-runs
- ✅ **OwnTracks Integration** - Receive GPS updates from mobile phones
- ✅ **Snowflake Theme** - Festive seasonal UI elements
- ✅ **Route Planning** - Next stop and destination calculation

---

## Design Decisions

### 1. **WebSocket + REST Hybrid Approach**
   - **REST API** for one-time operations (get stops, update stop details)
   - **WebSocket** for real-time bus state broadcasts (location, status)
   - **Rationale**: REST handles state mutations; WebSocket handles low-latency live updates
   - **Benefit**: Scalable, efficient, and appropriate for each use case

### 2. **SQLite Database with better-sqlite3**
   - **Choice**: SQLite (fast, file-based, no server needed)
   - **Driver**: better-sqlite3 (synchronous, performant)
   - **Rationale**: Ideal for small-medium events; easy deployment on single server
   - **Schema**: Two main tables (bus_info, stops) for simplicity and performance

### 3. **Token-Based Admin Authentication**
   - **Method**: URL-embedded admin token (`/admin/:token`)
   - **Rationale**: Simple, stateless, unpredictability prevents unauthorized access
   - **Advantage**: No session management required; works across browser restarts

### 4. **Caching Strategy**
   - **In-Memory Cache**: Stops and bus state cached in backend RAM
   - **Rationale**: High-frequency reads during map updates
   - **Selective Updates**: Only refresh cache on data mutations
   - **Benefit**: Reduces database I/O, improves response times

### 5. **Mobile Location via OwnTracks**
   - **Integration**: Webhook endpoint accepts GPS updates from OwnTracks
   - **Rationale**: Decouples mobile app choice; leverages existing OwnTracks ecosystem
   - **Method**: Phone sends location to OwnTracks server, forwards to our `/api/owntracks` endpoint
   - **Benefit**: Works with any phone OS; no custom mobile app needed

### 6. **CORS Allowlist**
   - **Strategy**: Whitelist known frontend origins
   - **Rationale**: Prevent cross-origin attacks while supporting multiple deployments
   - **Flexibility**: Allows local testing and production simultaneously

### 7. **React with Lazy Loading**
   - **Admin Component**: Lazy-loaded only when authenticated
   - **Rationale**: Reduces initial bundle size; improves page load time
   - **Benefit**: Keeps public interface lightweight

---

## Components & Relationships

### Frontend Components

| Component | Purpose | Relationships |
|-----------|---------|-----------------|
| **App.js** | Main entry point & routing | Manages state, routes to BusMap/Info/Admin |
| **BusMap** | Interactive Leaflet map | Displays bus marker, stop markers, driving routes |
| **Header** | Navigation & controls | Toggle info panels, access admin |
| **Information** | Caroling details display | Shows schedule, family names, notes |
| **Summary** | Next stop summary | Displays current & upcoming stops |
| **Admin** | Stop & family management | Create/edit/delete stops; manage families |
| **SnowFlakes** | Festive animation | Decorative seasonal element |
| **useBusSocket** | Custom WebSocket hook | Connects to backend, manages bus state |

**Data Flow**:
```
useBusSocket (WebSocket)
    ↓
Bus State & Stops
    ↓
BusMap, Summary, Information (receive updates)
    ↓
User interacts
    ↓
Admin sends REST API calls (add/update stops)
    ↓
Backend updates database & broadcasts
```

### Backend Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| **POST** | `/api/bus-location` | Update current bus GPS coordinates |
| **POST** | `/api/stop-arrived` | Mark stop as arrived (timestamp) |
| **POST** | `/api/stop-departed` | Mark stop as departed; set next destination |
| **GET** | `/api/getStops` | Retrieve all stops |
| **POST** | `/api/admin/:token/add-stop` | Create new stop (admin only) |
| **POST** | `/api/admin/:token/update-stop/:id` | Update stop (admin only) |
| **DELETE** | `/api/admin/:token/delete-stop/:id` | Delete stop (admin only) |
| **POST** | `/api/admin/:token/reorder-stops` | Reorder stops (admin only) |
| **GET** | `/api/admin/:token/validate-route` | Validate admin token |
| **POST** | `/api/owntracks` | Receive OwnTracks GPS webhook |

### Database Schema

**bus_info Table**
```sql
id              INTEGER PRIMARY KEY
lat             REAL (latitude)
lng             REAL (longitude)
current_stop    INTEGER (stop ID at current location)
destination_stop INTEGER (next planned stop)
destination_stop_override INTEGER (admin override for next stop)
trip_started    INTEGER (0 or 1, trip status)
status          TEXT ('idle' or 'en_route')
waiting_for_approval INTEGER (awaiting admin approval)
last_update     INTEGER (Unix timestamp)
```

**stops Table**
```sql
id              INTEGER PRIMARY KEY AUTOINCREMENT
address         TEXT (street address)
latitude        REAL
longitude       REAL
arrived         TEXT (timestamp when bus arrived)
departed        TEXT (timestamp when bus departed)
starting_time   TEXT (scheduled start time)
families        TEXT (JSON string of church/family mapping)
notes           TEXT (special instructions or info)
tag             TEXT (custom tags)
display_order   INTEGER (sort order for UI)
```

---

## Installation

### Prerequisites

- **Node.js** 14+ (backend)
- **npm** or **yarn** (package management)
- **Git** (for cloning)
- **SQLite3** (bundled with better-sqlite3)
- **OwnTracks Account** (optional, for mobile tracking)

### Backend Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/joshinsam7/Carol_singing.git
   cd Carol_singing/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file** in the backend directory:
   ```
   NODE_ENV=production
   ADMIN_ROUTE_TOKEN=your_secure_random_token_here
   ```

   **Generate a secure token** (example using OpenSSL):
   ```bash
   openssl rand -hex 32
   ```

4. **Configure database** (automatically initialized on first run):
   ```bash
   node server.js
   ```
   The app creates `bus_tracker.db` and initializes tables.

5. **Load initial stops** (optional):
   - Create a `database.json` file in the backend directory with stop data (see database.json format)
   - Stops auto-load on first server start

6. **Start the backend server:**
   ```bash
   npm start
   # or with nodemon for development:
   npm install -g nodemon
   nodemon server.js
   ```

   Server runs on **http://localhost:3001** by default.

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd ../frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env` file** in the frontend directory:
   ```
   REACT_APP_API=http://localhost:3001
   # For production:
   # REACT_APP_API=https://your-backend-domain.com
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```
   Frontend runs on **http://localhost:3000** and auto-opens in browser.

5. **Build for production:**
   ```bash
   npm build
   ```
   Generates optimized build in `build/` directory.

### OwnTracks Mobile Integration

OwnTracks allows sending real-time GPS location from your phone to Carol Tracker.

#### Setup Instructions:

1. **Install OwnTracks App**
   - **iOS**: Download from App Store
   - **Android**: Download from Google Play Store

2. **Configure OwnTracks App**
   - Open OwnTracks app settings
   - Select **Mode**: "HTTP" or "MQTT"
   - Set **URL**: `https://your-backend-domain.com/api/owntracks`
   - Set **User**: `phone` or any identifier
   - Set **Password**: Leave empty or use a placeholder
   - Enable **Location Services**: Allow Always
   - Set **Tracking Mode**: "Significant" or "Periodic"

3. **Backend Configuration** (optional)
   - Add `OWNTRACKS_API_TOKEN` to `.env` if you want token validation
   - Endpoint receives JSON with format:
     ```json
     {
       "lat": 29.620,
       "lon": -95.320,
       "user": "phone",
       "timestamp": 1234567890
     }
     ```

4. **Test the Integration**
   - Go to admin dashboard
   - Check if bus location updates when you move your phone
   - Verify timestamps in database

**OwnTracks Data Flow**:
```
Mobile Phone (OwnTracks App)
    ↓ (POST with GPS coordinates)
OwnTracks Server
    ↓ (Webhook forward)
Carol Tracker Backend (/api/owntracks)
    ↓ (Update database)
Database (bus_info table)
    ↓ (WebSocket broadcast)
All Connected Clients (real-time map update)
```

---

## Usage

### Public View

1. **Visit the app**: `http://localhost:3000`
2. **View live bus location** on the map
3. **See current & next stops** in the summary panel
4. **View family/church information** in the information panel
5. **Toggle between panels** using header buttons

### Admin Dashboard

1. **Access admin**: `http://localhost:3000/admin/YOUR_ADMIN_TOKEN`
   - Replace `YOUR_ADMIN_TOKEN` with the token from your `.env` file
2. **Add Stops**: Enter address, latitude/longitude, families
3. **Edit Stops**: Click a stop to modify details
4. **Delete Stops**: Remove stops from the route
5. **Reorder Stops**: Drag to change the caroling sequence
6. **Override Next Stop**: Force the bus to go to a specific stop

### Development - Simulation Mode

1. **Run the bus simulator** to test the app without real GPS:
   ```bash
   node simulate-bus.js
   ```
   This script simulates:
   - Bus location movements
   - Stop arrivals and departures
   - Automatic next-stop navigation
   - Timestamps for tracking

2. **Watch Live Updates**:
   - Open the frontend in a browser
   - See the simulated bus move on the map
   - Verify timestamps and stop transitions

---

## Environment Variables

### Backend (`.env`)

```
NODE_ENV=development|production
PORT=3001

# Security
ADMIN_ROUTE_TOKEN=<secure_random_hex_token>

# Optional
OWNTRACKS_API_TOKEN=<token_for_validation>
OWNTRACKS_WEBHOOK_SECRET=<webhook_signature_secret>

# CORS
# (Configured in server.js; modify allowedOrigins array for custom domains)
```

### Frontend (`.env`)

```
REACT_APP_API=http://localhost:3001|https://your-backend.com
```

---

## API Endpoints

### Public Endpoints

#### Get All Stops
```bash
GET /api/getStops
Response: { stops: [...] }
```

#### Update Bus Location
```bash
POST /api/bus-location
Body: { lat: 29.620, lon: -95.320 }
Response: { status: "success" }
```

#### Record Stop Arrival
```bash
POST /api/stop-arrived
Body: { stopId: 1, timestamp: 1708960800000 }
Response: { status: "success" }
```

#### Record Stop Departure
```bash
POST /api/stop-departed
Body: { stopId: 1, timestamp: 1708960800000, nextStopId: 2 }
Response: { status: "success" }
```

### Admin Endpoints (Require Token)

#### Add Stop
```bash
POST /api/admin/:token/add-stop
Headers: X-Admin-Route-Token: <token>
Body: { address: "123 Main St", latitude: 29.620, longitude: -95.320, families: {...} }
Response: { id: 5, ... }
```

#### Update Stop
```bash
POST /api/admin/:token/update-stop/:id
Headers: X-Admin-Route-Token: <token>
Body: { address: "456 Oak Ave", families: {...}, notes: "..." }
Response: { success: true }
```

#### Delete Stop
```bash
DELETE /api/admin/:token/delete-stop/:id
Headers: X-Admin-Route-Token: <token>
Response: { success: true }
```

#### Reorder Stops
```bash
POST /api/admin/:token/reorder-stops
Headers: X-Admin-Route-Token: <token>
Body: { order: [3, 1, 2, 4] } // array of stop IDs in new order
Response: { success: true }
```

### OwnTracks Webhook

#### Location Update from Mobile
```bash
POST /api/owntracks
Body: { lat: 29.620, lon: -95.320, user: "phone", timestamp: 1708960800 }
Response: { status: "location_received" }
```

---

## Development

### Project Structure
```
Carol_singing/
├── backend/
│   ├── server.js              # Express server & API
│   ├── database.js            # SQLite setup & initialization
│   ├── database.json          # Initial stops data
│   ├── simulate-bus.js        # Bus simulation for testing
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.js             # Main React component
│   │   ├── App.css            # Global styles
│   │   ├── index.js           # React entry point
│   │   ├── index.css          # Global CSS
│   │   ├── components/
│   │   │   ├── BusMap.js      # Leaflet map component
│   │   │   ├── Admin.js       # Admin dashboard
│   │   │   ├── Information.js # Info display
│   │   │   ├── Summary.js     # Summary panel
│   │   │   ├── header.js      # Navigation header
│   │   │   └── SnowFlakes.js  # Decorative animation
│   │   ├── hooks/
│   │   │   └── useBusSocket.js # WebSocket custom hook
│   │   ├── assets/            # Icons & images
│   │   └── ...
│   ├── public/
│   │   ├── index.html         # HTML template
│   │   ├── _redirects         # Netlify routing config
│   │   └── manifest.json      # PWA manifest
│   └── package.json
└── README.md
```

### Running Tests

Frontend:
```bash
cd frontend
npm test
```

### Debugging

**Backend**: Add debug logs to `server.js`
```javascript
console.log('Debug:', someValue);
```

**Frontend**: Open DevTools (F12) and check:
- Console for errors
- Network tab for API calls
- Application tab for localStorage/session

### Adding Features

1. **New API endpoint**: Add route to `server.js`
2. **New UI component**: Create file in `frontend/src/components/`
3. **Database changes**: Modify `database.js` schema and run migration
4. **WebSocket updates**: Broadcast from `broadcastBusState()` in server.js

---

## Deployment

### Backend Deployment (Render, Heroku, AWS)

1. **Prepare for production**:
   ```bash
   NODE_ENV=production
   ADMIN_ROUTE_TOKEN=<secure_token>
   ```

2. **Deploy to Render** (recommended):
   - Connect GitHub repository
   - Create Web Service from backend directory
   - Set environment variables
   - Deploy

3. **Deploy to Heroku**:
   ```bash
   heroku login
   heroku create carol-tracker-backend
   git push heroku main
   ```

### Frontend Deployment (Netlify, Vercel)

1. **Build frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to Netlify**:
   - Connect GitHub repository
   - Build command: `npm run build`
   - Publish directory: `build/`
   - Add environment variable: `REACT_APP_API=https://your-backend.com`
   - Deploy

3. **Deploy to Vercel**:
   - Import project
   - Select frontend directory
   - Set environment variables
   - Deploy

### Database Persistence

- **SQLite on Render**: Use volume mount or backup to S3
- **Backup Strategy**: Regularly export `bus_tracker.db` to external storage
- **Migration**: Export data from local DB before deploying to production

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| WebSocket connection fails | Check CORS allowlist; verify backend is running |
| Admin token invalid | Regenerate token; verify in `.env` and URL match |
| Bus location not updating | Check `/api/bus-location` POST requests; verify database permissions |
| OwnTracks location not received | Verify webhook URL is correct; check firewall/port settings |
| Map not loading | Verify Leaflet CSS is imported; check browser console for errors |
| Stop data not persisting | Check SQLite database file exists; verify write permissions |

---

## License

ISC

---

## Support & Contributions

For issues, questions, or contributions, please open an issue or pull request on GitHub.

**Happy Caroling! 🎄🎵**
