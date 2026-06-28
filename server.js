require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
// Serve frontend statically from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Path for storing local credentials and security questions
const CREDENTIALS_FILE = path.join(__dirname, 'admin_credentials.json');
const QUESTIONS_FILE = path.join(__dirname, 'security_questions.json');

// Memory storage for temporary reset tokens & active sessions
const resetTokens = {}; // format: { email: { token, expiry } }
const activeOtps = {}; // format: { email: { otp, expiry } }
const activeSessions = {}; // format: { token: { email, expiry } }

// Check if Firebase Client Config is configured
const isFirebaseConfigured = !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_API_KEY &&
    process.env.FIREBASE_AUTH_DOMAIN
);

let firebaseAdmin = null;
let firebaseEnabled = false;

if (isFirebaseConfigured && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    try {
        const admin = require('firebase-admin');
        firebaseAdmin = admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
            })
        });
        firebaseEnabled = true;
        console.log("Firebase Admin SDK initialized successfully. Firebase Auth Mode is active.");
    } catch (err) {
        console.error("Failed to initialize Firebase Admin SDK. Falling back to Local Auth Mode.", err.message);
    }
} else {
    console.log("Firebase Admin credentials not fully set. Running in Local Auth Mode.");
}

// Local Auth Helpers
function getLocalAdmins() {
    if (fs.existsSync(CREDENTIALS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
            if (Array.isArray(data)) {
                return data;
            } else if (data && data.email) {
                // Migrate single admin object to array format
                const migrated = [data];
                fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(migrated, null, 2), 'utf8');
                return migrated;
            }
        } catch (e) {
            console.error('Error reading credentials file:', e);
        }
    }
    return [];
}

function saveLocalAdmin(email, password, role) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    const admins = getLocalAdmins();

    const index = admins.findIndex(a => a.email === email);
    if (index !== -1) {
        admins[index].passwordHash = hash;
        if (role) {
            admins[index].role = role;
        }
    } else {
        if (admins.length >= 2) {
            throw new Error('Maximum 2 users (admins/managers) can be registered.');
        }
        admins.push({ email, passwordHash: hash, role: role || 'Admin' });
    }
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(admins, null, 2), 'utf8');
}

// Helper for security questions
function getSecurityQuestionsMap() {
    if (fs.existsSync(QUESTIONS_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8'));
            if (data && data.email && Array.isArray(data.questions)) {
                // Migrate single user format to map format
                const migrated = { [data.email]: data.questions };
                fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(migrated, null, 2), 'utf8');
                return migrated;
            }
            return data; // Already in map format
        } catch (e) {
            console.error('Error reading security questions file:', e);
        }
    }
    return {};
}

function saveSecurityQuestions(email, hashedQuestions) {
    const map = getSecurityQuestionsMap();
    map[email] = hashedQuestions;
    fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(map, null, 2), 'utf8');
}

// Unified Authentication Middleware
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized. Missing token.' });
    }
    const token = authHeader.split(' ')[1];

    if (firebaseEnabled) {
        try {
            const decodedToken = await firebaseAdmin.auth().verifyIdToken(token);
            req.adminUser = decodedToken;
            next();
        } catch (error) {
            return res.status(401).json({ success: false, error: 'Unauthorized. Invalid Firebase token.' });
        }
    } else {
        const session = activeSessions[token];
        if (session && Date.now() < session.expiry) {
            req.adminUser = { email: session.email, role: session.role };
            next();
        } else {
            return res.status(401).json({ success: false, error: 'Unauthorized. Session expired or invalid.' });
        }
    }
}

// Create nodemailer transporter dynamically based on .env config
const mailConfig = {};
if (process.env.SMTP_SERVICE) {
    mailConfig.service = process.env.SMTP_SERVICE;
} else {
    mailConfig.host = process.env.SMTP_HOST || 'smtp-mail.outlook.com';
    mailConfig.port = parseInt(process.env.SMTP_PORT || '587');
    mailConfig.secure = process.env.SMTP_SECURE === 'true';
}
mailConfig.auth = {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
};
mailConfig.tls = {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
};

const transporter = nodemailer.createTransport(mailConfig);

// Helper to retrieve brand logo for email attachment (embed as cid:logo)
function getMailAttachments() {
    const logoPath = path.join(__dirname, 'logo.png');
    if (fs.existsSync(logoPath)) {
        return [{
            filename: 'logo.png',
            path: logoPath,
            cid: 'logo'
        }];
    }
    return [];
}

// Helper to check if credentials are set
function isCredentialsConfigured() {
    const pass = process.env.EMAIL_PASS;
    return pass && pass !== 'YOUR_OUTLOOK_PASSWORD_OR_APP_PASSWORD' && pass.trim() !== '';
}

// Endpoint to send OTP
app.post('/api/send-otp', async (req, res) => {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
        return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
    }
    
    // Check if admin is registered (only in local auth mode)
    if (!firebaseEnabled) {
        const admins = getLocalAdmins();
        const adminExists = admins.some(a => a.email === email);
        if (!adminExists) {
            return res.status(404).json({ success: false, error: 'Admin email not registered.' });
        }
    }
    
    // Store in activeOtps for verification fallback
    activeOtps[email] = { otp: otp.toString(), expiry: Date.now() + 10 * 60 * 1000 };
    
    // Log OTP to server console for developer verification
    console.log(`\n==================================================`);
    console.log(`[SECURITY] PASSWORD RESET REQUEST RECEIVED`);
    console.log(`Account: ${email}`);
    console.log(`Verification OTP: ${otp}`);
    console.log(`==================================================\n`);
    
    if (!isCredentialsConfigured()) {
        return res.json({ 
            success: true, 
            warning: 'SMTP credentials are not configured in the .env file.',
            error: 'SMTP settings not fully configured. The reset code has been logged to the server terminal console.'
        });
    }

    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email, // Send OTP to the requesting admin's email
            subject: 'Agrawal Footwear & Crockery - Admin Verification Code (OTP)',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 500px; border-radius: 12px;">
                    <div style="text-align: center; border-bottom: 2px solid #302b63; padding-bottom: 15px; margin-bottom: 20px;">
                        <img src="cid:logo" alt="Logo" style="height: 65px; width: auto; object-fit: contain;">
                        <h2 style="color: #302b63; margin: 10px 0 0 0; font-size: 20px;">Agrawal Footwear & Crockery</h2>
                    </div>
                    <p>Hi Admin,</p>
                    <p>A request was made to reset the password for the admin account: <strong>${email}</strong>.</p>
                    <div style="background: #f4f4f4; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 20px 0; border-radius: 6px; color: #302b63; border: 1px solid #ddd;">
                        ${otp}
                    </div>
                    <p>Enter this code on the verification screen to reset your password.</p>
                    <p style="font-size: 11px; color: #999; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; text-align: center;">
                        Main Market Birsinghpur, Satna, Madhya Pradesh 485226
                    </p>
                </div>
            `,
            attachments: getMailAttachments()
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'OTP email sent successfully.' });
    } catch (error) {
        console.error('Error sending OTP email:', error);
        res.json({ 
            success: true, 
            warning: 'SMTP authentication failed.',
            error: error.message
        });
    }
});

// Endpoint to send order confirmation
app.post('/api/send-order', async (req, res) => {
    const { orderId, customerName, customerEmail, productName, price, paymentMethod, deliveryMethod } = req.body;

    if (!orderId || !customerName || !customerEmail || !productName) {
        return res.status(400).json({ success: false, error: 'All order fields (orderId, customerName, customerEmail, productName) are required.' });
    }

    const logOfflineOrder = (reason) => {
        console.log(`\n==================================================`);
        console.log(`[OFFLINE EMAIL FALLBACK] NEW ORDER CONFIRMATION LOGGED (${reason})`);
        console.log(`Order ID: ${orderId}`);
        console.log(`Customer: ${customerName} (${customerEmail})`);
        console.log(`Product: ${productName}`);
        console.log(`Price: ${price || 'Rs. 1,499.00'}`);
        console.log(`Payment: ${paymentMethod || 'UPI'}`);
        console.log(`Delivery: ${deliveryMethod || 'Home Delivery'}`);
        console.log(`==================================================\n`);
    };

    if (!isCredentialsConfigured()) {
        logOfflineOrder('SMTP UNCONFIGURED');
        return res.json({ 
            success: true, 
            warning: 'SMTP credentials are not configured in the .env file.',
            message: 'SMTP settings not fully configured. The order confirmation has been logged to the server terminal console.'
        });
    }

    try {
        const mailOptionsCustomer = {
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: `Agrawal Footwear & Crockery - Order Confirmed! #${orderId}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px; border-radius: 12px;">
                    <div style="text-align: center; border-bottom: 2px solid #302b63; padding-bottom: 15px; margin-bottom: 20px;">
                        <img src="cid:logo" alt="Logo" style="height: 65px; width: auto; object-fit: contain;">
                        <h2 style="color: #302b63; margin: 10px 0 0 0; font-size: 20px;">Agrawal Footwear & Crockery</h2>
                    </div>
                    <h3 style="color: #4a90e2; margin-top: 0;">Thank You for Your Order!</h3>
                    <p>Hi ${customerName},</p>
                    <p>Your order has been placed successfully at <strong>Agrawal Footwear & Crockery</strong>.</p>
                    
                    <div style="background: rgba(48, 43, 99, 0.03); border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px; color: #555;">Order ID:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${orderId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Product Ordered:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${productName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Price:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #302b63;">${price || 'Rs. 1,499.00'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Payment Method:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${paymentMethod || 'UPI'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Delivery Method:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deliveryMethod || 'Home Delivery'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Status:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: orange; font-weight: bold;">Pending Confirmation</td>
                            </tr>
                        </table>
                    </div>
                    
                    <p style="margin-top: 20px;">We will notify you once your order is accepted and out for delivery.</p>
                    <p>Best Regards,<br>Agrawal Footwear & Crockery</p>
                    <p style="font-size: 11px; color: #999; margin-top: 30px; border-top: 1px dashed #eee; padding-top: 10px; text-align: center;">
                        Main Market Birsinghpur, Satna, Madhya Pradesh 485226
                    </p>
                </div>
            `,
            attachments: getMailAttachments()
        };

        const mailOptionsAdmin = {
            from: process.env.EMAIL_USER,
            to: process.env.ADMIN_EMAIL, // Shravanagrawal62@gmail.com
            subject: `New Order Placed! #${orderId} - ${customerName}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px; border-radius: 12px;">
                    <div style="text-align: center; border-bottom: 2px solid #302b63; padding-bottom: 15px; margin-bottom: 20px;">
                        <img src="cid:logo" alt="Logo" style="height: 65px; width: auto; object-fit: contain;">
                        <h2 style="color: #302b63; margin: 10px 0 0 0; font-size: 20px;">Agrawal Footwear & Crockery</h2>
                    </div>
                    <h3 style="color: #9013fe; margin-top: 0;">New Order Received</h3>
                    <p>A new order has been placed on the store portal.</p>
                    
                    <div style="background: rgba(48, 43, 99, 0.03); border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px; color: #555;">Order ID:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${orderId}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Customer Name:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${customerName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Customer Email:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${customerEmail}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Product Ordered:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${productName}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Price:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #302b63;">${price || 'Rs. 1,499.00'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Payment Method:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${paymentMethod || 'UPI'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Delivery Method:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deliveryMethod || 'Home Delivery'}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            `,
            attachments: getMailAttachments()
        };

        // Send to both customer and admin
        await Promise.all([
            transporter.sendMail(mailOptionsCustomer),
            transporter.sendMail(mailOptionsAdmin)
        ]);

        res.json({ success: true, message: 'Order confirmation emails sent successfully.' });
    } catch (error) {
        console.error('Error sending order emails:', error);
        logOfflineOrder(`SMTP FAILED: ${error.message}`);
        res.json({ 
            success: true, 
            warning: 'SMTP delivery failed. Email logged to server console.',
            message: 'Order confirmation emails logged to console.' 
        });
    }
});

// Endpoint to send order update (Status and/or Delivery Changes)
app.post('/api/send-order-update', async (req, res) => {
    const { 
        orderId, 
        customerName, 
        customerEmail, 
        productName, 
        status, 
        delivery,
        price,
        deliveryMethod,
        paymentMethod
    } = req.body;

    if (!orderId || !customerName || !customerEmail || !status) {
        return res.status(400).json({ success: false, error: 'orderId, customerName, customerEmail, and status are required.' });
    }

    const logOfflineOrderUpdate = (reason) => {
        console.log(`\n==================================================`);
        console.log(`[OFFLINE EMAIL FALLBACK] ORDER STATUS UPDATE LOGGED (${reason})`);
        console.log(`Order ID: ${orderId}`);
        console.log(`Customer: ${customerName} (${customerEmail})`);
        console.log(`Product Name: ${productName || 'N/A'}`);
        console.log(`Order Status: ${status}`);
        console.log(`Delivery Details: ${delivery || 'Not set'}`);
        console.log(`==================================================\n`);
    };

    if (!isCredentialsConfigured()) {
        logOfflineOrderUpdate('SMTP UNCONFIGURED');
        return res.json({ 
            success: true, 
            warning: 'SMTP credentials are not configured in the .env file.',
            message: 'SMTP settings not fully configured. The order status update has been logged to the server terminal console.'
        });
    }

    try {
        let statusColor = '#302b63';
        let updateHeading = 'Order Update';
        
        if (status === 'Accepted') {
            statusColor = '#27ae60'; // Emerald Green
            updateHeading = 'Your Order Has Been Accepted!';
        } else if (status === 'Rejected') {
            statusColor = '#e74c3c'; // Coral Red
            updateHeading = 'Your Order Status Update';
        } else {
            statusColor = '#4a90e2'; // Light Blue
            updateHeading = 'Your Order Status Update';
        }

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: customerEmail,
            subject: `Agrawal Footwear & Crockery - Order Update #${orderId}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px; border-radius: 12px;">
                    <div style="text-align: center; border-bottom: 2px solid #302b63; padding-bottom: 15px; margin-bottom: 20px;">
                        <img src="cid:logo" alt="Logo" style="height: 65px; width: auto; object-fit: contain;">
                        <h2 style="color: #302b63; margin: 10px 0 0 0; font-size: 20px;">Agrawal Footwear & Crockery</h2>
                    </div>
                    <h3 style="color: ${statusColor}; margin-top: 0; font-size: 18px;">${updateHeading}</h3>
                    <p>Hi ${customerName},</p>
                    <p>We are writing to update you on your order with <strong>Agrawal Footwear & Crockery</strong>.</p>
                    
                    <div style="background: rgba(48, 43, 99, 0.03); border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 140px; color: #555;">Order ID:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${orderId}</td>
                            </tr>
                            ${productName ? `
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Product Name:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${productName}</td>
                            </tr>` : ''}
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Order Status:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; color: ${statusColor}; font-weight: bold;">${status}</td>
                            </tr>
                            ${deliveryMethod ? `
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Delivery Method:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${deliveryMethod}</td>
                            </tr>` : ''}
                            ${delivery && delivery !== 'Not set' ? `
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Shipping Details:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #302b63;">${delivery}</td>
                            </tr>` : ''}
                            ${price ? `
                            <tr>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; color: #555;">Grand Total:</td>
                                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">${price}</td>
                            </tr>` : ''}
                        </table>
                    </div>

                    <p style="margin-top: 20px;">If you have any questions, feel free to reply directly to this email or contact us at support@agrawalfootwear.com.</p>
                    <p>Best Regards,<br>Agrawal Footwear & Crockery</p>

                    <p style="font-size: 11px; color: #999; margin-top: 35px; border-top: 1px dashed #eee; padding-top: 12px; text-align: center;">
                        Agrawal Footwear and Crockery | Main Market Birsinghpur, Satna, MP 485226
                    </p>
                </div>
            `,
            attachments: getMailAttachments()
        };

        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: 'Order status update email sent successfully.' });
    } catch (error) {
        console.error('Error sending order update email:', error);
        logOfflineOrderUpdate(`SMTP FAILED: ${error.message}`);
        res.json({ 
            success: true, 
            warning: 'SMTP delivery failed. Email logged to server console.',
            message: 'Order status update logged to console.' 
        });
    }
});

// Get authentication configuration (mode and client-side firebase configuration)
app.get('/api/auth/config', (req, res) => {
    res.json({
        success: true,
        mode: firebaseEnabled ? 'firebase' : 'local',
        firebaseConfig: isFirebaseConfigured ? {
            apiKey: process.env.FIREBASE_API_KEY,
            authDomain: process.env.FIREBASE_AUTH_DOMAIN,
            projectId: process.env.FIREBASE_PROJECT_ID,
            storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            appId: process.env.FIREBASE_APP_ID
        } : null
    });
});

// Local Register (only allowed if less than 2 admins exist)
app.post('/api/auth/register', (req, res) => {
    if (firebaseEnabled) {
        return res.status(400).json({ success: false, error: 'Registration is handled by Firebase Auth.' });
    }
    const { email, password, role } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    
    const admins = getLocalAdmins();
    const existingAdmin = admins.find(a => a.email === email);
    if (existingAdmin) {
        return res.status(400).json({ success: false, error: 'Admin already registered with this email.' });
    }
    
    if (admins.length >= 2) {
        return res.status(400).json({ success: false, error: 'Maximum 2 admins can be registered.' });
    }
    
    try {
        const userRole = admins.length === 0 ? 'Admin' : (role || 'Admin');
        saveLocalAdmin(email, password, userRole);
        
        // Notify primary admin via email
        const currentAdmins = getLocalAdmins();
        const primaryAdminEmail = currentAdmins[0] ? currentAdmins[0].email : process.env.ADMIN_EMAIL;
        if (primaryAdminEmail && isCredentialsConfigured()) {
            const alertMailOptions = {
                from: process.env.EMAIL_USER,
                to: primaryAdminEmail,
                subject: 'New Admin Registered - Agrawal Footwear & Crockery',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 500px; border-radius: 12px;">
                        <h2 style="color: #302b63; margin-top: 0;">New Admin Registration Alert</h2>
                        <p>Hello Primary Admin,</p>
                        <p>A new admin has been successfully registered on the store administration portal.</p>
                        <p><strong>Registered Email:</strong> ${email}</p>
                        <p><strong>Registration Time:</strong> ${new Date().toLocaleString()}</p>
                        <hr style="border-color: #eee; margin: 20px 0;">
                        <p style="font-size: 11px; color: #999;">This is an automated security notification. If you did not authorize this registration, please remove this administrator from the Security Settings tab immediately.</p>
                    </div>
                `
            };
            transporter.sendMail(alertMailOptions).catch(err => console.error('Error sending registration alert email to primary admin:', err));
        }

        res.json({ success: true, message: 'Admin registered successfully.' });
    } catch (e) {
        res.status(400).json({ success: false, error: e.message });
    }
});

// Local Login
app.post('/api/auth/login', (req, res) => {
    if (firebaseEnabled) {
        return res.status(400).json({ success: false, error: 'Login is handled by Firebase Auth.' });
    }
    const { email, password, role, rememberMe } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' });
    }
    const admins = getLocalAdmins();
    const admin = admins.find(a => a.email === email);
    
    // Fallback role for backward compatibility
    const adminRole = admin ? (admin.role || (admins[0]?.email === email ? 'Admin' : 'Admin')) : null;

    if (admin && bcrypt.compareSync(password, admin.passwordHash)) {
        if (role && adminRole !== role) {
            return res.status(401).json({ success: false, error: `Invalid login type. User is not registered as ${role}.` });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        const sessionDuration = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000; // 30 days vs 2 hours
        
        activeSessions[token] = {
            email: admin.email,
            role: adminRole,
            expiry: Date.now() + sessionDuration
        };
        res.json({ success: true, token, email: admin.email, role: adminRole });
    } else {
        res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
});

// Local Logout
app.post('/api/auth/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        delete activeSessions[token];
    }
    res.json({ success: true, message: 'Logged out successfully.' });
});

// Save customizable security questions
app.post('/api/admin/save-questions', requireAuth, (req, res) => {
    const { email, questions } = req.body; // questions = [{ q: '...', a: '...' }, ...]
    if (!email || !questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ success: false, error: 'Email and questions are required.' });
    }

    // Verify requesting email matches authorized email
    const reqEmail = req.adminUser.email;
    if (reqEmail !== email) {
        return res.status(403).json({ success: false, error: 'Forbidden. Email mismatch.' });
    }

    const hashedQuestions = questions.map(item => {
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(item.a.toLowerCase().trim(), salt);
        return { q: item.q, a: hash };
    });

    saveSecurityQuestions(email, hashedQuestions);
    res.json({ success: true, message: 'Security questions saved successfully.' });
});

// Get customizable security questions for password reset (Public)
app.post('/api/admin/get-reset-questions', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, error: 'Email is required.' });
    }

    const map = getSecurityQuestionsMap();
    const adminQuestions = map[email];
    if (!adminQuestions || !Array.isArray(adminQuestions)) {
        return res.status(404).json({ success: false, error: 'No security questions set up for this admin.' });
    }

    // Return only the questions, not the answers!
    const questionsOnly = adminQuestions.map(q => q.q);
    res.json({ success: true, questions: questionsOnly });
});

// Verify security answers (Public)
app.post('/api/admin/verify-reset-answers', (req, res) => {
    const { email, answers } = req.body; // answers = [ 'answer1', 'answer2', ... ]
    if (!email || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ success: false, error: 'Email and answers are required.' });
    }

    const map = getSecurityQuestionsMap();
    const adminQuestions = map[email];
    if (!adminQuestions || !Array.isArray(adminQuestions)) {
        return res.status(404).json({ success: false, error: 'No security questions set up for this admin.' });
    }

    if (answers.length !== adminQuestions.length) {
        return res.status(400).json({ success: false, error: 'Incorrect number of answers.' });
    }

    // Verify each answer
    for (let i = 0; i < adminQuestions.length; i++) {
        const entered = answers[i].toLowerCase().trim();
        const storedHash = adminQuestions[i].a;
        if (!bcrypt.compareSync(entered, storedHash)) {
            return res.status(400).json({ success: false, error: 'Incorrect security answers.' });
        }
    }

    // Answers are correct! Generate a reset token
    const token = crypto.randomBytes(32).toString('hex');
    resetTokens[email] = {
        token,
        expiry: Date.now() + 10 * 60 * 1000 // 10 minutes expiry
    };

    res.json({ success: true, resetToken: token });
});

// Reset password using verified token (Public)
app.post('/api/admin/reset-password', async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
        return res.status(400).json({ success: false, error: 'Email, token, and new password are required.' });
    }

    const activeToken = resetTokens[email];
    const activeOtp = activeOtps[email];
    let isValid = false;

    if (activeToken && activeToken.token === token && Date.now() < activeToken.expiry) {
        isValid = true;
        delete resetTokens[email];
    } else if (activeOtp && activeOtp.otp === token && Date.now() < activeOtp.expiry) {
        isValid = true;
        delete activeOtps[email];
    }

    if (!isValid) {
        return res.status(400).json({ success: false, error: 'Invalid or expired reset token or OTP.' });
    }

    try {
        if (firebaseEnabled) {
            // Reset in Firebase Auth
            const userRecord = await firebaseAdmin.auth().getUserByEmail(email);
            await firebaseAdmin.auth().updateUser(userRecord.uid, { password: newPassword });
        } else {
            // Reset in Local Auth
            const admins = getLocalAdmins();
            const admin = admins.find(a => a.email === email);
            if (!admin) {
                return res.status(400).json({ success: false, error: 'Admin user not found.' });
            }
            saveLocalAdmin(email, newPassword);
        }

        res.json({ success: true, message: 'Password reset successfully.' });
    } catch (err) {
        console.error('Error resetting password:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// List all registered admins with roles (Protected)
app.get('/api/admin/list', requireAuth, (req, res) => {
    const admins = getLocalAdmins();
    const adminList = admins.map((a, index) => ({
        email: a.email,
        role: a.role || (index === 0 ? 'Admin' : 'Admin'),
        isPrimary: index === 0
    }));
    res.json({ success: true, admins: adminList });
});

// Create or update a secondary admin/manager (Protected, primary admin only)
app.post('/api/admin/save-secondary', requireAuth, (req, res) => {
    const admins = getLocalAdmins();
    if (admins.length === 0) {
        return res.status(400).json({ success: false, error: 'No primary admin registered.' });
    }
    const primaryAdmin = admins[0].email;
    if (req.adminUser.email !== primaryAdmin) {
        return res.status(403).json({ success: false, error: 'Only the primary admin can manage secondary users.' });
    }

    const { email, password, role } = req.body;
    if (!email || !role) {
        return res.status(400).json({ success: false, error: 'Email and role are required.' });
    }
    if (email === primaryAdmin) {
        return res.status(400).json({ success: false, error: 'Cannot modify the primary admin.' });
    }
    if (role !== 'Admin' && role !== 'Manager') {
        return res.status(400).json({ success: false, error: 'Role must be Admin or Manager.' });
    }

    const secondaryIndex = admins.findIndex(a => a.email !== primaryAdmin);

    if (secondaryIndex !== -1) {
        // Update existing secondary user
        const oldEmail = admins[secondaryIndex].email;
        admins[secondaryIndex].email = email;
        admins[secondaryIndex].role = role;
        if (password && password.trim() !== '') {
            const salt = bcrypt.genSaltSync(10);
            admins[secondaryIndex].passwordHash = bcrypt.hashSync(password, salt);
        }
        
        // Update security questions key if email changed
        if (oldEmail !== email) {
            const questionsMap = getSecurityQuestionsMap();
            if (questionsMap[oldEmail]) {
                questionsMap[email] = questionsMap[oldEmail];
                delete questionsMap[oldEmail];
                fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questionsMap, null, 2), 'utf8');
            }
        }
    } else {
        // Create new secondary user
        if (admins.length >= 2) {
            return res.status(400).json({ success: false, error: 'Maximum 2 users (admins/managers) can be registered.' });
        }
        if (!password) {
            return res.status(400).json({ success: false, error: 'Password is required for new users.' });
        }
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(password, salt);
        admins.push({ email, passwordHash: hash, role });
    }

    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(admins, null, 2), 'utf8');
    res.json({ success: true, message: 'Secondary user saved successfully.' });
});

// Remove second admin (Protected, primary admin only)
app.post('/api/admin/remove-admin', requireAuth, (req, res) => {
    const { emailToRemove } = req.body;
    if (!emailToRemove) {
        return res.status(400).json({ success: false, error: 'Email to remove is required.' });
    }
    const admins = getLocalAdmins();
    if (admins.length === 0) {
        return res.status(400).json({ success: false, error: 'No admins registered.' });
    }
    
    const primaryAdmin = admins[0].email;
    // Verify requester is primary admin
    if (req.adminUser.email !== primaryAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden. Only the primary admin can remove other admins.' });
    }
    
    if (emailToRemove === primaryAdmin) {
        return res.status(400).json({ success: false, error: 'The primary admin cannot be removed.' });
    }
    
    const index = admins.findIndex(a => a.email === emailToRemove);
    if (index === -1) {
        return res.status(404).json({ success: false, error: 'Admin not found.' });
    }
    
    // Remove the admin
    admins.splice(index, 1);
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(admins, null, 2), 'utf8');
    
    // Clean up security questions
    const questionsMap = getSecurityQuestionsMap();
    if (questionsMap[emailToRemove]) {
        delete questionsMap[emailToRemove];
        fs.writeFileSync(QUESTIONS_FILE, JSON.stringify(questionsMap, null, 2), 'utf8');
    }
    
    res.json({ success: true, message: 'Admin removed successfully.' });
});

// Visitor counter endpoint
const VISITOR_FILE = path.join(__dirname, 'visitor_count.json');

app.post('/api/visit', (req, res) => {
    let count = 0;
    try {
        if (fs.existsSync(VISITOR_FILE)) {
            const data = JSON.parse(fs.readFileSync(VISITOR_FILE, 'utf8'));
            count = parseInt(data.count) || 0;
        }
    } catch (e) {
        console.error("Error reading visitor file:", e);
    }
    
    const { increment } = req.body;
    if (increment) {
        count++;
        try {
            fs.writeFileSync(VISITOR_FILE, JSON.stringify({ count }), 'utf8');
        } catch (e) {
            console.error("Error writing visitor file:", e);
        }
    }
    res.json({ success: true, count });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

