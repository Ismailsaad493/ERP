const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Local SQLite Database
const db = new sqlite3.Database('./krazon_erp.sqlite', (err) => {
    if (err) {
        console.error("Error opening database: " + err.message);
    } else {
        // Create Master Invoice Table
        db.run(`CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT UNIQUE,
            date TEXT,
            buyer_details TEXT,
            tax_type TEXT,
            subtotal REAL,
            total REAL
        )`);

        // Create Line Items Table
        db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT,
            description TEXT,
            qty REAL,
            rate REAL,
            amount REAL,
            FOREIGN KEY (invoice_no) REFERENCES invoices(invoice_no)
        )`);
    }
});

// API: Get the next gapless invoice number
app.get('/api/next-invoice-no', (req, res) => {
    db.get("SELECT COUNT(*) as count FROM invoices", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const nextNum = row.count + 1;
        // Format: KRZ/26-27/001
        const invoice_no = `KRZ/26-27/${String(nextNum).padStart(3, '0')}`;
        res.json({ invoice_no });
    });
});

// API: Save the invoice and its items (Kept in backend in case you need it later)
app.post('/api/save-invoice', (req, res) => {
    const { invoice_no, date, buyer_details, tax_type, subtotal, total, items } = req.body;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        // 1. Save the main invoice record
        const insertInvoice = `INSERT INTO invoices (invoice_no, date, buyer_details, tax_type, subtotal, total) VALUES (?, ?, ?, ?, ?, ?)`;
        db.run(insertInvoice, [invoice_no, date, buyer_details, tax_type, subtotal, total], function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }

            // 2. Save all line items
            const insertItem = `INSERT INTO invoice_items (invoice_no, description, qty, rate, amount) VALUES (?, ?, ?, ?, ?)`;
            const stmt = db.prepare(insertItem);
            
            items.forEach(item => {
                stmt.run([invoice_no, item.description, item.qty, item.rate, item.amount]);
            });
            
            stmt.finalize((err) => {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                db.run('COMMIT');
                res.json({ success: true, message: 'Invoice saved successfully!' });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`ERP Server running at http://localhost:${PORT}`);
});