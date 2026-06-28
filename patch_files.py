import os

def patch_file(filepath, replacements):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return False
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    has_crlf = '\r\n' in content
    if has_crlf:
        content = content.replace('\r\n', '\n')
    
    modified = False
    for target, replacement in replacements:
        # Standardize target line endings too
        target_norm = target.replace('\r\n', '\n')
        replacement_norm = replacement.replace('\r\n', '\n')
        if target_norm in content:
            content = content.replace(target_norm, replacement_norm)
            print(f"Patched target in {filepath}")
            modified = True
        else:
            print(f"Warning: Target not found in {filepath}: {target_norm[:50]}...")
            
    if modified:
        if has_crlf:
            content = content.replace('\n', '\r\n')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Saved changes to {filepath}")
        return True
    else:
        print(f"No changes made to {filepath}")
        return False

# Replacements for index.html
index_replacements = [
    # Remove logo.js and config.js from head
    (
        '''    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="logo.js"></script>
    <script src="config.js"></script>
    <style>''',
        '''    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>'''
    ),
    # Remove logo.js only if config.js is not present
    (
        '''    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <script src="logo.js"></script>
    <style>''',
        '''    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
    <style>'''
    ),
    # Nav button hover fix
    (
        '''        nav button:hover {
            color: #fff;
            border-color: var(--primary-accent);
            background: rgba(74, 144, 226, 0.1);
            box-shadow: 0 0 15px rgba(74, 144, 226, 0.3);
            transform: translateY(-2px);
        }''',
        '''        nav button:hover {
            color: #fff;
            border-color: var(--primary-accent);
            background: var(--primary-accent);
            box-shadow: 0 0 15px rgba(74, 144, 226, 0.3);
            transform: translateY(-2px);
        }'''
    ),
    # Input placeholder styling
    (
        '''        input,
        textarea,
        select {
            width: 95%;
            padding: 12px 16px;
            margin: 10px 0;
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            font-family: var(--font-ui);
            transition: all 0.3s ease;
        }''',
        '''        input,
        textarea,
        select {
            width: 95%;
            padding: 12px 16px;
            margin: 10px 0;
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            font-family: var(--font-ui);
            transition: all 0.3s ease;
        }

        ::placeholder {
            color: var(--text-secondary);
            opacity: 0.8;
        }'''
    ),
    # Btn secondary styling
    (
        '''        .btn-secondary {
            background: transparent;
            color: #fff;
            border: 1px solid var(--surface-border);
            padding: 12px 28px;
            border-radius: 30px;
            font-family: var(--font-ui);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-secondary:hover {
            border-color: #fff;
            background: rgba(255, 255, 255, 0.05);
        }''',
        '''        .btn-secondary {
            background: transparent;
            color: var(--text-primary);
            border: 1px solid var(--surface-border);
            padding: 12px 28px;
            border-radius: 30px;
            font-family: var(--font-ui);
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .btn-secondary:hover {
            border-color: var(--text-primary);
            background: rgba(255, 255, 255, 0.1);
        }'''
    ),
    # Hero showcase box background/border and h4 color
    (
        '''        .hero-showcase-box {
            position: relative;
            z-index: 2;
            background: rgba(255, 255, 255, 0.05);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 25px;
            width: 220px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.4);
            transition: all 0.3s ease;
        }

        .hero-showcase-box:hover {
            transform: scale(1.03) rotate(1deg);
            border-color: rgba(255,255,255,0.25);
        }''',
        '''        .hero-showcase-box {
            position: relative;
            z-index: 2;
            background: var(--surface-color);
            backdrop-filter: blur(16px);
            border: 1px solid var(--surface-border);
            border-radius: 16px;
            padding: 25px;
            width: 220px;
            box-shadow: 0 15px 35px rgba(0,0,0,0.4);
            transition: all 0.3s ease;
        }

        .hero-showcase-box:hover {
            transform: scale(1.03) rotate(1deg);
            border-color: var(--primary-accent);
        }'''
    ),
    (
        '''        .hero-showcase-box h4 {
            margin: 8px 0 5px 0;
            font-family: var(--font-headings);
            font-size: 1.3rem;
            color: #fff;
        }''',
        '''        .hero-showcase-box h4 {
            margin: 8px 0 5px 0;
            font-family: var(--font-headings);
            font-size: 1.3rem;
            color: var(--text-primary);
        }'''
    ),
    # Philosophy section h3
    (
        '''        .philosophy-section h3 {
            font-family: var(--font-headings);
            font-size: 2.2rem;
            margin: 0 0 35px 0;
            color: #fff;
        }''',
        '''        .philosophy-section h3 {
            font-family: var(--font-headings);
            font-size: 2.2rem;
            margin: 0 0 35px 0;
            color: var(--text-primary);
        }'''
    ),
    # Phil item h4
    (
        '''        .phil-item h4 {
            font-family: var(--font-headings);
            font-size: 1.3rem;
            margin: 0 0 10px 0;
            color: #fff;
        }''',
        '''        .phil-item h4 {
            font-family: var(--font-headings);
            font-size: 1.3rem;
            margin: 0 0 10px 0;
            color: var(--text-primary);
        }'''
    ),
    # Posts header h3
    (
        '''        .posts-header h3 {
            font-family: var(--font-headings);
            font-size: 2.2rem;
            margin: 0;
            color: #fff;
        }''',
        '''        .posts-header h3 {
            font-family: var(--font-headings);
            font-size: 2.2rem;
            margin: 0;
            color: var(--text-primary);
        }'''
    ),
    # Post body h4, p, and post-link hover
    (
        '''        .post-body h4 {
            font-family: var(--font-headings);
            font-size: 1.25rem;
            margin: 0 0 10px 0;
            color: #fff;
            line-height: 1.3;
            height: 50px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .post-body p {
            font-size: 13px;
            color: #bbb;
            line-height: 1.5;
            margin: 0 0 15px 0;
            height: 60px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
        }

        .post-link {
            font-size: 12px;
            font-weight: 600;
            color: var(--primary-accent);
        }

        .post-card:hover .post-link {
            color: #fff;
        }''',
        '''        .post-body h4 {
            font-family: var(--font-headings);
            font-size: 1.25rem;
            margin: 0 0 10px 0;
            color: var(--text-primary);
            line-height: 1.3;
            height: 50px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
        }

        .post-body p {
            font-size: 13px;
            color: var(--text-secondary);
            line-height: 1.5;
            margin: 0 0 15px 0;
            height: 60px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
        }

        .post-link {
            font-size: 12px;
            font-weight: 600;
            color: var(--primary-accent);
        }

        .post-card:hover .post-link {
            color: var(--text-primary);
        }'''
    ),
    # Modal content
    (
        '''        .modal-content {
            background: #1b1b22;
            border: 1px solid var(--surface-border);
            border-radius: 20px;
            max-width: 700px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            padding: 35px;
            position: relative;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            color: #eee;
        }''',
        '''        .modal-content {
            background: var(--select-option-bg, #1b1b22);
            border: 1px solid var(--surface-border);
            border-radius: 20px;
            max-width: 700px;
            width: 90%;
            max-height: 85vh;
            overflow-y: auto;
            padding: 35px;
            position: relative;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            color: var(--text-primary);
        }'''
    ),
    # Modal body innerHTML titles/content color in script
    (
        '''                <h2 style="font-family: var(--font-headings); font-size: 2rem; margin: 8px 0 20px 0; color: #fff;">${post.title}</h2>
                <div class="post-content-full" style="line-height: 1.6; font-size: 15px; color: #ccc;">''',
        '''                <h2 style="font-family: var(--font-headings); font-size: 2rem; margin: 8px 0 20px 0; color: var(--text-primary);">${post.title}</h2>
                <div class="post-content-full" style="line-height: 1.6; font-size: 15px; color: var(--text-secondary);">'''
    ),
    # API_BASE variable injection
    (
        '''    <script>
        // Theme System configurations''',
        '''    <script>
        const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:5000' : '';
        // Theme System configurations'''
    ),
    # Send order fetch URL replacement
    (
        '''                // Send email notification via backend
                fetch('http://localhost:5000/api/send-order', {''',
        '''                // Send email notification via backend
                fetch(API_BASE + '/api/send-order', {'''
    ),
    # downloadInvoice dynamic script and off-screen box
    (
        '''        // Generate and download a professional PDF invoice
        function downloadInvoice(orderId) {
            let orders = JSON.parse(localStorage.getItem("orders")) || [];
            let order = orders.find(o => o.id == orderId);
            if (!order) {
                alert("Order not found!");
                return;
            }

            // Create temporary container for invoice HTML inside viewport but invisible
            let invoiceWrapper = document.createElement("div");
            invoiceWrapper.id = "temp-invoice-wrapper";
            invoiceWrapper.style.position = "fixed";
            invoiceWrapper.style.top = "0";
            invoiceWrapper.style.left = "0";
            invoiceWrapper.style.width = "800px";
            invoiceWrapper.style.zIndex = "-99999";
            invoiceWrapper.style.opacity = "0";
            invoiceWrapper.style.pointerEvents = "none";
            invoiceWrapper.style.background = "#fff";

            let invoiceEl = document.createElement("div");
            invoiceEl.style.padding = "35px 40px";
            invoiceEl.style.fontFamily = "'Outfit', 'Segoe UI', Arial, sans-serif";
            invoiceEl.style.color = "#1e1e2d";
            invoiceEl.style.background = "#fff";
            invoiceEl.style.width = "720px";
            invoiceWrapper.appendChild(invoiceEl);
            document.body.appendChild(invoiceWrapper);''',
        '''        // Generate and download a professional PDF invoice
        function downloadInvoice(orderId) {
            let orders = JSON.parse(localStorage.getItem("orders")) || [];
            let order = orders.find(o => o.id == orderId);
            if (!order) {
                alert("Order not found!");
                return;
            }

            // Load logo.js dynamically if not already loaded (prevents large blocking script on page load)
            if (typeof LOGO_BASE64 === 'undefined') {
                const script = document.createElement('script');
                script.src = 'logo.js';
                script.onload = () => {
                    proceedDownloadInvoice(order);
                };
                script.onerror = () => {
                    console.warn("logo.js failed to load. Downloading invoice with logo.png fallback.");
                    proceedDownloadInvoice(order);
                };
                document.head.appendChild(script);
            } else {
                proceedDownloadInvoice(order);
            }
        }

        function proceedDownloadInvoice(order) {
            // Create temporary container for invoice HTML off-screen (opacity: 0 blocks html2canvas)
            let invoiceWrapper = document.createElement("div");
            invoiceWrapper.id = "temp-invoice-wrapper";
            invoiceWrapper.style.position = "absolute";
            invoiceWrapper.style.top = "-9999px";
            invoiceWrapper.style.left = "-9999px";
            invoiceWrapper.style.width = "800px";
            invoiceWrapper.style.zIndex = "-99999";
            invoiceWrapper.style.background = "#fff";

            let invoiceEl = document.createElement("div");
            invoiceEl.style.padding = "35px 40px";
            invoiceEl.style.fontFamily = "'Outfit', 'Segoe UI', Arial, sans-serif";
            invoiceEl.style.color = "#1e1e2d";
            invoiceEl.style.background = "#fff";
            invoiceEl.style.width = "720px";
            invoiceWrapper.appendChild(invoiceEl);
            document.body.appendChild(invoiceWrapper);'''
    )
]

# Replacements for admin.html
admin_replacements = [
    # Remove logo.js and config.js from head
    (
        '''    <script src="logo.js"></script>
    <script src="config.js"></script>
    <!-- Firebase SDK Compat -->''',
        '''    <!-- Firebase SDK Compat -->'''
    ),
    (
        '''    <script src="logo.js"></script>
    <!-- Firebase SDK Compat -->''',
        '''    <!-- Firebase SDK Compat -->'''
    ),
    # th color and background
    (
        '''        th {
            background: rgba(255, 255, 255, 0.05);
            color: #fff;
            font-family: var(--font-ui);
            font-weight: 600;
        }''',
        '''        th {
            background: var(--primary-accent);
            color: #fff;
            font-family: var(--font-ui);
            font-weight: 600;
        }'''
    ),
    # tab-btn:hover styling
    (
        '''        .tab-btn:hover {
            color: #fff;
            border-color: var(--primary-accent);
            background: rgba(74, 144, 226, 0.1);
            transform: translateY(-2px);
        }''',
        '''        .tab-btn:hover {
            color: #fff;
            border-color: var(--primary-accent);
            background: var(--primary-accent);
            transform: translateY(-2px);
        }'''
    ),
    # Input placeholder
    (
        '''        input,
        textarea,
        select {
            width: 95%;
            padding: 12px 16px;
            margin: 10px 0;
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            font-family: var(--font-ui);
            transition: all 0.3s ease;
        }''',
        '''        input,
        textarea,
        select {
            width: 95%;
            padding: 12px 16px;
            margin: 10px 0;
            border: 1px solid var(--surface-border);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.05);
            color: var(--text-primary);
            font-family: var(--font-ui);
            transition: all 0.3s ease;
        }

        ::placeholder {
            color: var(--text-secondary);
            opacity: 0.8;
        }'''
    ),
    # API_BASE variable injection in admin.html
    (
        '''    <script>
        // Theme System configurations''',
        '''    <script>
        const API_BASE = (window.location.protocol === 'file:') ? 'http://localhost:5000' : '';
        // Theme System configurations'''
    ),
    # localhost replacements in fetch calls (config)
    (
        '''                const res = await fetch('http://localhost:5000/api/auth/config');''',
        '''                const res = await fetch(API_BASE + '/api/auth/config');'''
    ),
    # localhost replacements (save security questions)
    (
        '''                const res = await fetch('http://localhost:5000/api/admin/save-questions', {''',
        '''                const res = await fetch(API_BASE + '/api/admin/save-questions', {'''
    ),
    # localhost replacements (verify reset answers)
    (
        '''                const res = await fetch('http://localhost:5000/api/admin/verify-reset-answers', {''',
        '''                const res = await fetch(API_BASE + '/api/admin/verify-reset-answers', {'''
    ),
    # localhost replacements (reset password)
    (
        '''                const res = await fetch('http://localhost:5000/api/admin/reset-password', {''',
        '''                const res = await fetch(API_BASE + '/api/admin/reset-password', {'''
    ),
    # localhost replacements (send order update email in updateStatus)
    (
        '''                const res = await fetch('http://localhost:5000/api/send-order-update', {''',
        '''                const res = await fetch(API_BASE + '/api/send-order-update', {'''
    ),
    # localhost replacements (send OTP)
    (
        '''            fetch('http://localhost:5000/api/send-otp', {''',
        '''            fetch(API_BASE + '/api/send-otp', {'''
    ),
    # Offline login logic check
    (
        '''            try {
                const res = await fetch('http://localhost:5000/api/auth/config');''',
        '''            try {
                const res = await fetch(API_BASE + '/api/auth/config');'''
    ),
    # Offline config load error fallback
    (
        '''            } catch (e) {
                console.error("Failed to load security config:", e);
                document.getElementById("securityModeStatus").innerText = "Offline (Local Local Storage Fallback)";
                document.getElementById("securityModeDesc").innerText = "Could not connect to the backend server. Falling back to unsecure localStorage auth. Start the backend on port 5000 to enable secure auth.";
            }''',
        '''            } catch (e) {
                console.error("Failed to load security config:", e);
                authMode = 'offline';
                document.getElementById("securityModeStatus").innerText = "Offline (Local Local Storage Fallback)";
                document.getElementById("securityModeDesc").innerText = "Could not connect to the backend server. Falling back to unsecure localStorage auth. Start the backend on port 5000 to enable secure auth.";
                
                // Check offline session storage
                const savedEmail = sessionStorage.getItem("adminEmail") || localStorage.getItem("adminEmail");
                if (savedEmail) {
                    loggedInAdmin = { email: savedEmail };
                    currentUserToken = \'offline-token\';
                    document.getElementById("loginCard").style.display = "none";
                    document.getElementById("dashboard").style.display = "block";
                    loadProducts();
                    loadOrders();
                    loadReviews();
                    loadBrandStories();
                }
            }'''
    ),
    # Offline register fallback
    (
        '''            } else {
                // Local Register
                try {
                    const res = await fetch('http://localhost:5000/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password: pw })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("Admin registered successfully! Please log in.");
                        document.getElementById("registerCard").style.display = "none";
                        document.getElementById("loginCard").style.display = "block";
                    } else {
                        alert("Registration failed: " + data.error);
                    }
                } catch (e) {
                    alert("Could not connect to the backend server.");
                }
            }''',
        '''            } else if (authMode === 'offline') {
                // Offline Fallback Register
                try {
                    let offlineAdmins = JSON.parse(localStorage.getItem('offlineAdmins')) || [];
                    if (offlineAdmins.some(a => a.email === email)) {
                        alert("Admin already registered offline with this email.");
                        return;
                    }
                    offlineAdmins.push({ email, password: pw }); // Store plaintext for offline demo fallback
                    localStorage.setItem('offlineAdmins', JSON.stringify(offlineAdmins));
                    alert("Admin registered offline successfully! Please log in.");
                    document.getElementById("registerCard").style.display = "none";
                    document.getElementById("loginCard").style.display = "block";
                } catch (e) {
                    alert("Offline registration failed: " + e.message);
                }
            } else {
                // Local Register
                try {
                    const res = await fetch(API_BASE + '/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password: pw })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("Admin registered successfully! Please log in.");
                        document.getElementById("registerCard").style.display = "none";
                        document.getElementById("loginCard").style.display = "block";
                    } else {
                        alert("Registration failed: " + data.error);
                    }
                } catch (e) {
                    alert("Could not connect to the backend server.");
                }
            }'''
    ),
    # Offline login fallback and localStorage session storage sync
    (
        '''            } else {
                // Local Auth Login
                try {
                    const res = await fetch('http://localhost:5000/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password: pw })
                    });
                    const data = await res.json();
                    if (data.success) {
                        loggedInAdmin = { email: email };
                        currentUserToken = data.token;
                        sessionStorage.setItem("adminEmail", email);
                        sessionStorage.setItem("adminToken", data.token);
                        document.getElementById("loginCard").style.display = "none";
                        document.getElementById("dashboard").style.display = "block";
                        loadProducts();
                        loadOrders();
                        loadReviews();
                        loadBrandStories();
                    } else {
                        alert("Login failed: " + data.error);
                    }
                } catch (e) {
                    alert("Failed to connect to the backend server.");
                }
            }''',
        '''            } else if (authMode === 'offline') {
                // Offline Fallback Login
                let offlineAdmins = JSON.parse(localStorage.getItem('offlineAdmins')) || [];
                const admin = offlineAdmins.find(a => a.email === email && a.password === pw);
                if (admin) {
                    loggedInAdmin = { email: email };
                    currentUserToken = \'offline-token\';
                    sessionStorage.setItem("adminEmail", email);
                    sessionStorage.setItem("adminToken", \'offline-token\');
                    localStorage.setItem("adminEmail", email);
                    localStorage.setItem("adminToken", \'offline-token\');
                    document.getElementById("loginCard").style.display = "none";
                    document.getElementById("dashboard").style.display = "block";
                    loadProducts();
                    loadOrders();
                    loadReviews();
                    loadBrandStories();
                } else {
                    alert("Login failed: Invalid email or password (offline mode).");
                }
            } else {
                // Local Auth Login
                try {
                    const res = await fetch(API_BASE + '/api/auth/login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, password: pw })
                    });
                    const data = await res.json();
                    if (data.success) {
                        loggedInAdmin = { email: email };
                        currentUserToken = data.token;
                        sessionStorage.setItem("adminEmail", email);
                        sessionStorage.setItem("adminToken", data.token);
                        localStorage.setItem("adminEmail", email);
                        localStorage.setItem("adminToken", data.token);
                        document.getElementById("loginCard").style.display = "none";
                        document.getElementById("dashboard").style.display = "block";
                        loadProducts();
                        loadOrders();
                        loadReviews();
                        loadBrandStories();
                    } else {
                        alert("Login failed: " + data.error);
                    }
                } catch (e) {
                    alert("Failed to connect to the backend server.");
                }
            }'''
    ),
    # Local logout clear local storage session
    (
        '''        function logoutFrontend() {
            loggedInAdmin = null;
            currentUserToken = null;
            sessionStorage.removeItem("adminEmail");
            sessionStorage.removeItem("adminToken");
            document.getElementById("dashboard").style.display = "none";
            document.getElementById("loginCard").style.display = "block";
        }''',
        '''        function logoutFrontend() {
            loggedInAdmin = null;
            currentUserToken = null;
            sessionStorage.removeItem("adminEmail");
            sessionStorage.removeItem("adminToken");
            localStorage.removeItem("adminEmail");
            localStorage.removeItem("adminToken");
            document.getElementById("dashboard").style.display = "none";
            document.getElementById("loginCard").style.display = "block";
        }'''
    ),
    # downloadInvoice in admin.html
    (
        '''        // Generate and download a professional PDF invoice (Admin)
        function downloadInvoice(orderId) {
            let orders = JSON.parse(localStorage.getItem("orders")) || [];
            let order = orders.find(o => o.id == orderId);
            if (!order) {
                alert("Order not found!");
                return;
            }

            // Create temporary container for invoice HTML inside viewport but invisible
            let invoiceWrapper = document.createElement("div");
            invoiceWrapper.id = "temp-invoice-wrapper";
            invoiceWrapper.style.position = "fixed";
            invoiceWrapper.style.top = "0";
            invoiceWrapper.style.left = "0";
            invoiceWrapper.style.width = "800px";
            invoiceWrapper.style.zIndex = "-99999";
            invoiceWrapper.style.opacity = "0";
            invoiceWrapper.style.pointerEvents = "none";
            invoiceWrapper.style.background = "#fff";

            let invoiceEl = document.createElement("div");
            invoiceEl.style.padding = "35px 40px";
            invoiceEl.style.fontFamily = "'Outfit', 'Segoe UI', Arial, sans-serif";
            invoiceEl.style.color = "#1e1e2d";
            invoiceEl.style.background = "#fff";
            invoiceEl.style.width = "720px";
            invoiceWrapper.appendChild(invoiceEl);
            document.body.appendChild(invoiceWrapper);''',
        '''        // Generate and download a professional PDF invoice (Admin)
        function downloadInvoice(orderId) {
            let orders = JSON.parse(localStorage.getItem("orders")) || [];
            let order = orders.find(o => o.id == orderId);
            if (!order) {
                alert("Order not found!");
                return;
            }

            // Load logo.js dynamically if not already loaded (prevents large blocking script on page load)
            if (typeof LOGO_BASE64 === 'undefined') {
                const script = document.createElement('script');
                script.src = 'logo.js';
                script.onload = () => {
                    proceedDownloadInvoice(order);
                };
                script.onerror = () => {
                    console.warn("logo.js failed to load. Downloading invoice with logo.png fallback.");
                    proceedDownloadInvoice(order);
                };
                document.head.appendChild(script);
            } else {
                proceedDownloadInvoice(order);
            }
        }

        function proceedDownloadInvoice(order) {
            // Create temporary container for invoice HTML off-screen (opacity: 0 blocks html2canvas)
            let invoiceWrapper = document.createElement("div");
            invoiceWrapper.id = "temp-invoice-wrapper";
            invoiceWrapper.style.position = "absolute";
            invoiceWrapper.style.top = "-9999px";
            invoiceWrapper.style.left = "-9999px";
            invoiceWrapper.style.width = "800px";
            invoiceWrapper.style.zIndex = "-99999";
            invoiceWrapper.style.background = "#fff";

            let invoiceEl = document.createElement("div");
            invoiceEl.style.padding = "35px 40px";
            invoiceEl.style.fontFamily = "'Outfit', 'Segoe UI', Arial, sans-serif";
            invoiceEl.style.color = "#1e1e2d";
            invoiceEl.style.background = "#fff";
            invoiceEl.style.width = "720px";
            invoiceWrapper.appendChild(invoiceEl);
            document.body.appendChild(invoiceWrapper);'''
    ),
    (
        '''            // Generate and save the PDF, cleaning up afterwards
            html2pdf().from(invoiceEl).set(opt).save().then(() => {
                document.body.removeChild(invoiceWrapper);
            }).catch(err => {
                console.error("PDF generation failed:", err);
                document.body.removeChild(invoiceWrapper);
            });''',
        '''            // Generate and save the PDF, cleaning up afterwards
            html2pdf().from(invoiceEl).set(opt).save().then(() => {
                document.body.removeChild(invoiceWrapper);
            }).catch(err => {
                console.error("PDF generation failed:", err);
                document.body.removeChild(invoiceWrapper);
            });'''
    )
]

print("Applying patches to root index.html...")
patch_file("index.html", index_replacements)

print("Applying patches to root admin.html...")
patch_file("admin.html", admin_replacements)

print("Applying patches to frontend/index.html...")
patch_file("frontend/index.html", index_replacements)

print("Applying patches to frontend/admin.html...")
patch_file("frontend/admin.html", admin_replacements)

print("Patching completed.")
