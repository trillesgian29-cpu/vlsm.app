# NetCalc Pro — VLSM Calculator Flask App

Full-stack VLSM Calculator with Cisco CLI Generator, user authentication, and SQLite database.

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the app
python app.py

# 3. Open browser
http://localhost:5000
```

## File Structure

```
vlsm-flask/
├── app.py                  ← Flask app, routes, IP math, CLI generators
├── requirements.txt
├── vlsm.db                 ← SQLite database (auto-created on first run)
├── templates/
│   ├── auth.html           ← Login + Signup page
│   ├── dashboard.html      ← User dashboard + history
│   ├── calculator.html     ← Main VLSM calculator
│   └── partials/
│       └── topbar.html     ← Shared navigation bar
└── static/
    ├── css/app.css         ← Dark networking theme
    └── js/app.js           ← Frontend calculator logic
```

## Features

- Sign Up / Login / Logout with hashed passwords (werkzeug)
- Session-based authentication
- VLSM and FLSM subnet calculation
- Cisco IOS CLI generation for Static, RIP v2, EIGRP, OSPF
- Calculation history saved to SQLite
- Packet Tracer ready output
