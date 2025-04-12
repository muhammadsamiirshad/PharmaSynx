const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function resetDatabase() {
    try {
        const db = await open({
            filename: path.join(__dirname, 'pharmacy.db'), // Match your server.js database filename
            driver: sqlite3.Database
        });

        console.log('Connected to database, dropping tables...');
        
        // Drop existing tables in reverse order of dependencies
        await db.run('DROP TABLE IF EXISTS sale_items');
        await db.run('DROP TABLE IF EXISTS sales');
        await db.run('DROP TABLE IF EXISTS products');
        
        console.log('Creating products table...');
        // Create products table with proper expiry_date field
        await db.run(`
            CREATE TABLE products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT,
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0,
                unit TEXT DEFAULT 'pcs',
                default_qty INTEGER DEFAULT 1,
                photo TEXT,
                expiry_date TEXT
            )
        `);
        
        console.log('Creating sales table...');
        // Create sales table
        await db.run(`
            CREATE TABLE sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total REAL NOT NULL,
                subtotal REAL NOT NULL,
                discount REAL DEFAULT 0,
                date TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        console.log('Creating sale_items table...');
        // Create sale_items table
        await db.run(`
            CREATE TABLE sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                product_id INTEGER,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                name TEXT NOT NULL,
                unit TEXT NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            )
        `);
        
        // Insert some sample products for testing
        console.log('Inserting sample data...');
        await db.run(`
            INSERT INTO products (name, description, category, price, stock, unit, default_qty, expiry_date)
            VALUES 
            ('Paracetamol', 'Pain reliever 500mg', 'Analgesics', 10.99, 100, 'tabs', 10, '2025-12-31'),
            ('Ibuprofen', 'Anti-inflammatory 400mg', 'Analgesics', 15.50, 50, 'tabs', 10, '2024-08-15'),
            ('Amoxicillin', 'Antibiotic 250mg', 'Antibiotics', 25.00, 30, 'caps', 1, '2025-06-30'),
            ('Cetirizine', 'Antihistamine 10mg', 'Allergy', 8.75, 40, 'tabs', 10, '2026-03-25'),
            ('Vitamin C', 'Supplement 1000mg', 'Vitamins', 12.99, 80, 'tabs', 5, '2027-01-10')
        `);
        
        console.log('Database reset successfully');
        await db.close();
    } catch (err) {
        console.error('Error resetting database:', err);
    }
}

// Execute the reset function
resetDatabase().then(() => {
    console.log('Database reset completed');
}).catch(err => {
    console.error('Database reset failed:', err);
});