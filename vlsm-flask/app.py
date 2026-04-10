"""
VLSM Calculator + Routing CLI Generator
Flask application with SQLite authentication
"""

import os
import sqlite3
import json
import math
from flask import (
    Flask, render_template, request, redirect,
    url_for, session, jsonify, g
)
from werkzeug.security import generate_password_hash, check_password_hash

# ── App Setup ────────────────────────────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'vlsm-dev-secret-key-change-in-production')

DATABASE = 'vlsm.db'

# ── Database Helpers ─────────────────────────────────────────

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS calculations (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id    INTEGER NOT NULL,
                title      TEXT NOT NULL,
                base_net   TEXT NOT NULL,
                mode       TEXT NOT NULL,
                result     TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        ''')
        db.commit()

# ── Auth Helpers ─────────────────────────────────────────────

def login_required(f):
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def current_user():
    if 'user_id' not in session:
        return None
    db = get_db()
    return db.execute('SELECT * FROM users WHERE id = ?', (session['user_id'],)).fetchone()

# ── IP Math (Python) ─────────────────────────────────────────

def ip_to_int(ip):
    parts = ip.strip().split('.')
    return sum(int(p) << (24 - 8 * i) for i, p in enumerate(parts))

def int_to_ip(n):
    n = n & 0xFFFFFFFF
    return '.'.join(str((n >> (24 - 8 * i)) & 255) for i in range(4))

def prefix_to_mask(prefix):
    if prefix == 0:
        return 0
    shift = 32 - prefix
    return ((0xFFFFFFFF << shift) & 0xFFFFFFFF)

def wildcard_mask(mask_int):
    return (~mask_int) & 0xFFFFFFFF

def mask_to_prefix(mask_int):
    count = 0
    n = mask_int
    while n & 0x80000000:
        count += 1
        n = (n << 1) & 0xFFFFFFFF
    return count

def get_octet_label(prefix):
    if prefix >= 25: return '4th'
    if prefix >= 17: return '3rd'
    if prefix >= 9:  return '2nd'
    return '1st'

def get_octet_increment(prefix):
    if prefix >= 25: return 2 ** (32 - prefix)
    if prefix >= 17: return 2 ** (24 - prefix)
    if prefix >= 9:  return 2 ** (16 - prefix)
    return 2 ** (8 - prefix)

def build_subnet_row(no, network_int, prefix, input_hosts=None):
    mask_int   = prefix_to_mask(prefix)
    block_size = 2 ** (32 - prefix)
    calc_hosts = block_size - 2 if prefix <= 30 else (2 if prefix == 31 else 1)
    wc         = wildcard_mask(mask_int)
    bcast_int  = (network_int | wc) & 0xFFFFFFFF
    first_int  = network_int if prefix >= 31 else network_int + 1
    last_int   = bcast_int   if prefix >= 31 else bcast_int - 1

    return {
        'no':         no,
        'hosts':      input_hosts if input_hosts is not None else max(0, calc_hosts),
        'cidr':       f'/{prefix}',
        'octet':      get_octet_label(prefix),
        'increment':  get_octet_increment(prefix),
        'block_size': block_size,
        'network_id': int_to_ip(network_int),
        'mask':       int_to_ip(mask_int),
        'first':      int_to_ip(first_int),
        'last':       int_to_ip(last_int),
        'broadcast':  int_to_ip(bcast_int),
        'network_int': network_int,
        'mask_int':   mask_int,
        'prefix':     prefix,
        'wildcard':   int_to_ip(wc),
    }

def calc_vlsm(base_net, requirements):
    """Calculate VLSM subnets. Returns list of subnet dicts."""
    sorted_reqs = sorted(enumerate(requirements), key=lambda x: -x[1])
    cursor = ip_to_int(base_net)
    results = [None] * len(requirements)

    for orig_idx, hosts in sorted_reqs:
        prefix = 30
        while prefix >= 1:
            if 2 ** (32 - prefix) - 2 >= hosts:
                break
            prefix -= 1
        if prefix < 1:
            raise ValueError(f'Cannot fit {hosts} hosts in any subnet')

        row = build_subnet_row(orig_idx + 1, cursor, prefix, hosts)
        results[orig_idx] = row
        cursor = (cursor + 2 ** (32 - prefix)) & 0xFFFFFFFF

    return results

def calc_flsm(base_net, mask_input, count):
    """Calculate FLSM subnets."""
    base_int = ip_to_int(base_net)
    prefix   = int(mask_input) if str(mask_input).isdigit() else mask_to_prefix(ip_to_int(mask_input))
    subnet_bits = 0
    while (1 << subnet_bits) < count:
        subnet_bits += 1
    new_prefix = prefix + subnet_bits
    if new_prefix > 30:
        raise ValueError(f'Not enough space for {count} subnets')
    increment = 2 ** (32 - new_prefix)
    rows = []
    for i in range(count):
        net_int = (base_int + i * increment) & 0xFFFFFFFF
        rows.append(build_subnet_row(i + 1, net_int, new_prefix))
    return rows

# ── Routing CLI Generators ───────────────────────────────────

def get_major_network(ip):
    parts = [int(x) for x in ip.split('.')]
    a, b, c = parts[0], parts[1], parts[2]
    if 1 <= a <= 126:   return f'{a}.0.0.0'
    if 128 <= a <= 191: return f'{a}.{b}.0.0'
    if 192 <= a <= 223: return f'{a}.{b}.{c}.0'
    return None

def ip_to_int_s(ip):
    """Safe version that returns 0 on bad input."""
    try: return ip_to_int(ip)
    except: return 0

def generate_static(router_idx, routers, subnets, serial_links, topo="ring"):
    """
    Generate static routing for one router.
    Routes ONLY to remote LAN networks. BFS next-hop.
    """
    ri = router_idx
    router = routers[ri]
    r_name = router['name']

    # Build adjacency graph
    graph = [[] for _ in routers]
    for li, link in enumerate(serial_links):
        r1, r2 = link['r1'], link['r2']
        if r1 >= 0 and r2 >= 0:
            graph[r1].append({'neighbor': r2, 'link_idx': li})
            graph[r2].append({'neighbor': r1, 'link_idx': li})

    # BFS: first hop link from src toward dst
    def first_hop_link(src, dst):
        if src == dst: return None
        visited = [False] * len(routers)
        queue   = [(src, None)]
        visited[src] = True
        while queue:
            cur, fhl = queue.pop(0)
            for edge in graph[cur]:
                nb = edge['neighbor']
                if visited[nb]: continue
                visited[nb] = True
                resolved = fhl if fhl is not None else edge['link_idx']
                if nb == dst: return resolved
                queue.append((nb, resolved))
        return None

    # My directly connected networks (LAN + serial)
    my_nets = set(router.get('lans', []))
    for link in serial_links:
        if (link['r1'] == ri or link['r2'] == ri) and link.get('net_index', -1) >= 0:
            my_nets.add(link['net_index'])

    cli  = 'enable\n'
    cli += 'configure terminal\n'
    cli += '!\n'
    cli += f'! Static routing for {r_name}\n'
    cli += '!\n'

    for si, s in enumerate(subnets):
        if si in my_nets:
            continue
        # Find owner router
        owner = -1
        for r2i, r2 in enumerate(routers):
            if r2i == ri: continue
            if si in r2.get('lans', []):
                owner = r2i; break
            for link in serial_links:
                if (link['r1'] == r2i or link['r2'] == r2i) and link.get('net_index', -1) == si:
                    owner = r2i; break
            if owner >= 0: break
        if owner < 0: continue

        li = first_hop_link(ri, owner)
        if li is None: continue
        link    = serial_links[li]
        net     = subnets[link['net_index']] if link.get('net_index', -1) >= 0 else None
        if not net: continue
        gateway = net['last'] if link['r1'] == ri else net['first']
        cli    += f'ip route {s["network_id"]} {s["mask"]} {gateway}\n'

    cli += 'end\n'
    return cli

def generate_rip(router_idx, routers, subnets, serial_links):
    """RIP v2 — classful major networks, no auto-summary."""
    ri     = router_idx
    router = routers[ri]
    nets   = set(router.get('lans', []))
    for link in serial_links:
        if (link['r1'] == ri or link['r2'] == ri) and link.get('net_index', -1) >= 0:
            nets.add(link['net_index'])

    major_nets = set()
    for si in nets:
        mn = get_major_network(subnets[si]['network_id'])
        if mn: major_nets.add(mn)

    cli  = 'enable\n'
    cli += 'configure terminal\n'
    cli += '!\n'
    cli += 'router rip\n'
    cli += ' version 2\n'
    cli += ' no auto-summary\n'
    for mn in sorted(major_nets):
        cli += f' network {mn}\n'
    cli += '!\n'
    cli += 'end\n'
    return cli

def generate_eigrp(router_idx, routers, subnets, serial_links, as_num=100):
    """EIGRP — wildcard masks, all connected networks."""
    ri     = router_idx
    router = routers[ri]
    net_objs = []
    seen     = set()

    for si in router.get('lans', []):
        if si not in seen:
            seen.add(si)
            net_objs.append(subnets[si])
    for link in serial_links:
        if link['r1'] != ri and link['r2'] != ri: continue
        idx = link.get('net_index', -1)
        if idx >= 0 and idx not in seen:
            seen.add(idx)
            net_objs.append(subnets[idx])

    cli  = 'enable\n'
    cli += 'configure terminal\n'
    cli += '!\n'
    cli += f'! EIGRP AS {as_num} — must match on ALL routers\n'
    cli += f'router eigrp {as_num}\n'
    cli += 'no auto-summary\n'
    for s in net_objs:
        cli += f'network {s["network_id"]} {s["wildcard"]}\n'
    cli += '!\n'
    cli += 'end\n'
    return cli

def generate_ospf(router_idx, routers, subnets, serial_links, pid=1):
    """OSPF — wildcard masks, area 0, all connected networks."""
    ri     = router_idx
    router = routers[ri]
    net_objs = []
    seen     = set()

    for si in router.get('lans', []):
        if si not in seen:
            seen.add(si)
            net_objs.append(subnets[si])
    for link in serial_links:
        if link['r1'] != ri and link['r2'] != ri: continue
        idx = link.get('net_index', -1)
        if idx >= 0 and idx not in seen:
            seen.add(idx)
            net_objs.append(subnets[idx])

    cli  = 'enable\n'
    cli += 'configure terminal\n'
    cli += '!\n'
    cli += f'! OSPF Process ID {pid} — locally significant\n'
    cli += f'router ospf {pid}\n'
    for s in net_objs:
        cli += f'network {s["network_id"]} {s["wildcard"]} area 0\n'
    cli += '!\n'
    cli += 'end\n'
    return cli

def generate_interfaces(router_idx, routers, subnets, serial_links):
    """Stage 1: Interface configuration for one router."""
    ri     = router_idx
    router = routers[ri]
    r_name = router['name']

    cli  = 'enable\n'
    cli += 'configure terminal\n'
    cli += f'hostname {r_name}\n'
    cli += '!\n'

    for idx, si in enumerate(router.get('lans', [])):
        if idx > 1: break
        s    = subnets[si]
        cli += f'interface FastEthernet0/{idx}\n'
        cli += f' ip address {s["first"]} {s["mask"]}\n'
        cli += ' no shutdown\n'
        cli += '!\n'

    port_idx = 0
    for link in serial_links:
        if link['r1'] != ri and link['r2'] != ri: continue
        idx = link.get('net_index', -1)
        if idx < 0: continue
        s      = subnets[idx]
        iface  = f'Serial0/1/{port_idx}'
        is_dce = link['r1'] == ri
        my_ip  = s['first'] if is_dce else s['last']
        cli   += f'interface {iface}\n'
        cli   += f' ip address {my_ip} {s["mask"]}\n'
        if is_dce:
            cli += ' clock rate 64000\n'
        cli += ' no shutdown\n'
        cli += '!\n'
        port_idx += 1

    cli += 'end\n'
    return cli

# ── Routes: Auth ─────────────────────────────────────────────

@app.route('/')
def index():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        confirm  = request.form.get('confirm', '').strip()

        if not username or not password:
            error = 'Username and password are required.'
        elif len(username) < 3:
            error = 'Username must be at least 3 characters.'
        elif len(password) < 6:
            error = 'Password must be at least 6 characters.'
        elif password != confirm:
            error = 'Passwords do not match.'
        else:
            db = get_db()
            existing = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
            if existing:
                error = 'Username already taken.'
            else:
                hashed = generate_password_hash(password)
                db.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, hashed))
                db.commit()
                row = db.execute('SELECT id FROM users WHERE username = ?', (username,)).fetchone()
                session['user_id']  = row['id']
                session['username'] = username
                return redirect(url_for('dashboard'))

    return render_template('auth.html', page='signup', error=error)

@app.route('/login', methods=['GET', 'POST'])
def login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        if not username or not password:
            error = 'Enter your username and password.'
        else:
            db  = get_db()
            row = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
            if row and check_password_hash(row['password'], password):
                session['user_id']  = row['id']
                session['username'] = row['username']
                return redirect(url_for('dashboard'))
            else:
                error = 'Invalid username or password.'

    return render_template('auth.html', page='login', error=error)

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

# ── Routes: App ──────────────────────────────────────────────

@app.route('/dashboard')
@login_required
def dashboard():
    db   = get_db()
    rows = db.execute(
        'SELECT id, title, base_net, mode, created_at FROM calculations WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
        (session['user_id'],)
    ).fetchall()
    return render_template('dashboard.html', username=session.get('username'), history=rows)

@app.route('/calculator')
@login_required
def calculator():
    return render_template('calculator.html', username=session.get('username'))

# ── API: Calculate ───────────────────────────────────────────

@app.route('/api/calculate', methods=['POST'])
@login_required
def api_calculate():
    data = request.get_json()
    mode = data.get('mode', 'vlsm')

    try:
        if mode == 'vlsm':
            base_net = data['base_net'].strip()
            reqs     = [int(h) for h in data['hosts']]
            if not reqs:
                return jsonify({'error': 'Add at least one subnet.'}), 400
            subnets = calc_vlsm(base_net, reqs)
        else:
            base_net = data['base_net'].strip()
            mask     = data['mask']
            count    = int(data['count'])
            subnets  = calc_flsm(base_net, mask, count)

        # Compute next available
        last      = subnets[-1]
        next_int  = (last['network_int'] + last['block_size']) & 0xFFFFFFFF
        next_addr = int_to_ip(next_int)

        # Save to history
        db    = get_db()
        title = f"{base_net} — {mode.upper()} ({len(subnets)} subnets)"
        db.execute(
            'INSERT INTO calculations (user_id, title, base_net, mode, result) VALUES (?,?,?,?,?)',
            (session['user_id'], title, base_net, mode, json.dumps(subnets))
        )
        db.commit()

        return jsonify({'subnets': subnets, 'next_available': next_addr, 'title': title})

    except Exception as e:
        return jsonify({'error': str(e)}), 400

# ── API: Generate CLI ────────────────────────────────────────

@app.route('/api/generate_cli', methods=['POST'])
@login_required
def api_generate_cli():
    data         = request.get_json()
    subnets      = data['subnets']
    routers_data = data['routers']
    serial_links = data['serial_links']
    protocol     = data.get('protocol', 'static')
    eigrp_as     = int(data.get('eigrp_as', 100))
    ospf_pid     = int(data.get('ospf_pid', 1))

    outputs = []
    for ri, router in enumerate(routers_data):
        iface_cli = generate_interfaces(ri, routers_data, subnets, serial_links)

        if protocol == 'static':
            route_cli = generate_static(ri, routers_data, subnets, serial_links, data.get('topo', 'ring'))
        elif protocol == 'rip':
            route_cli = generate_rip(ri, routers_data, subnets, serial_links)
        elif protocol == 'eigrp':
            route_cli = generate_eigrp(ri, routers_data, subnets, serial_links, eigrp_as)
        elif protocol == 'ospf':
            route_cli = generate_ospf(ri, routers_data, subnets, serial_links, ospf_pid)
        else:
            route_cli = ''

        outputs.append({
            'name':       router['name'],
            'interfaces': iface_cli,
            'routing':    route_cli,
        })

    return jsonify({'routers': outputs})

# ── API: History ─────────────────────────────────────────────

@app.route('/api/history/<int:calc_id>')
@login_required
def api_history(calc_id):
    db  = get_db()
    row = db.execute(
        'SELECT * FROM calculations WHERE id = ? AND user_id = ?',
        (calc_id, session['user_id'])
    ).fetchone()
    if not row:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({
        'title':   row['title'],
        'subnets': json.loads(row['result']),
    })

# ── Run ──────────────────────────────────────────────────────

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)

# ── JSON Auth API (for React frontend) ──────────────────────

@app.route('/api/auth/signup', methods=['POST'])
def api_signup():
    data     = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password required.'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters.'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters.'}), 400

    db = get_db()
    if db.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone():
        return jsonify({'error': 'Username already taken.'}), 409

    hashed = generate_password_hash(password)
    db.execute('INSERT INTO users (username, password) VALUES (?,?)', (username, hashed))
    db.commit()
    row = db.execute('SELECT id FROM users WHERE username=?', (username,)).fetchone()
    session['user_id']  = row['id']
    session['username'] = username
    return jsonify({'user': {'id': row['id'], 'username': username}})

@app.route('/api/auth/login', methods=['POST'])
def api_login():
    data     = request.get_json()
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    db  = get_db()
    row = db.execute('SELECT * FROM users WHERE username=?', (username,)).fetchone()
    if not row or not check_password_hash(row['password'], password):
        return jsonify({'error': 'Invalid username or password.'}), 401

    session['user_id']  = row['id']
    session['username'] = row['username']
    return jsonify({'user': {'id': row['id'], 'username': row['username']}})

@app.route('/api/auth/logout', methods=['POST'])
def api_logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/auth/me')
def api_me():
    if 'user_id' not in session:
        return jsonify({'error': 'Not authenticated'}), 401
    return jsonify({'user': {'id': session['user_id'], 'username': session.get('username')}})

@app.route('/api/history')
@login_required
def api_history_list():
    db   = get_db()
    rows = db.execute(
        'SELECT id, title, base_net, mode, created_at FROM calculations WHERE user_id=? ORDER BY created_at DESC LIMIT 10',
        (session['user_id'],)
    ).fetchall()
    return jsonify({'history': [dict(r) for r in rows]})

# ── Serve React build (production) ──────────────────────────
import os as _os

@app.route('/app', defaults={'path': ''})
@app.route('/app/<path:path>')
def react_app(path):
    dist = _os.path.join(app.root_path, 'static', 'dist')
    target = _os.path.join(dist, path)
    if path and _os.path.exists(target):
        return app.send_static_file(f'dist/{path}')
    return app.send_static_file('dist/index.html')
