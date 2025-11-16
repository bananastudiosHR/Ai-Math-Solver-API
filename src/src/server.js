const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
// Use the PORT provided by Render (or 3000 locally)
const PORT = process.env.PORT || 3000; 

// --- SECURELY GETTING CREDENTIALS FROM RENDER ENVIRONMENT ---
// These keys (DB_HOST, DB_USER, etc.) must match the names you set on Render.
const DB_CONFIG = {
    host: process.env.DB_HOST, 
    port: process.env.DB_PORT, 
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_DATABASE,
    // Enable SSL for TiDB Cloud connections
    ssl: {
        rejectUnauthorized: true 
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};
// -------------------------------------------------------------

// Create a connection pool to TiDB
const pool = mysql.createPool(DB_CONFIG);

// Middleware
// Allows connections from your Playcode front-end (or any origin for testing)
app.use(cors()); 
app.use(express.json()); // Allows parsing of JSON request bodies

// --- 1. POST Endpoint for Creating a New User (Signup) ---
app.post('/api/user', async (req, res) => {
    // Expects id, username, and password from the client-side signup form
    const { id, username, password, warnings = 0 } = req.body;

    if (!id || !username || !password) {
        return res.status(400).json({ message: 'Missing required fields: id, username, or password.' });
    }

    try {
        const sql = 'INSERT INTO users (id, username, password, warnings) VALUES (?, ?, ?, ?)';
        await pool.execute(sql, [id, username, password, warnings]);
        
        return res.status(201).json({ 
            message: 'Account created successfully', 
            userId: id 
        });

    } catch (error) {
        console.error('TiDB Insert Error:', error.code, error.message);
        // Handle duplicate username error (ER_DUP_ENTRY)
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists.' });
        }
        return res.status(500).json({ message: 'Database error during account creation.' });
    }
});

// --- 2. GET Endpoint for Fetching All Users (Admin Panel) ---
app.get('/api/users', async (req, res) => {
    try {
        // Fetches all fields needed for the Admin Panel display
        const sql = 'SELECT id, username, password, warnings FROM users';
        const [users] = await pool.query(sql); 
        
        // Sends the array of user objects back to the Playcode client
        res.status(200).json(users);
    } catch (error) {
        console.error('TiDB Select Error:', error.message);
        res.status(500).json({ message: 'Database error fetching users.' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`Server running securely on port ${PORT}`);
    console.log(`TiDB Host: ${DB_CONFIG.host}`);
});