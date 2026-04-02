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
                generic_name TEXT,
                description TEXT,
                category TEXT,
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0,
                strips_per_box INTEGER DEFAULT 1,
                tabs_per_strip INTEGER DEFAULT 1,
                price_per_box REAL DEFAULT 0,
                price_per_strip REAL DEFAULT 0,
                price_per_tablet REAL DEFAULT 0,
                base_stock INTEGER DEFAULT 0,
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
            INSERT INTO products (
                name,
                generic_name,
                description,
                category,
                price,
                strips_per_box,
                tabs_per_strip,
                price_per_box,
                price_per_strip,
                price_per_tablet,
                base_stock,
                unit,
                default_qty,
                expiry_date
            )
            VALUES 
            ('Panadol', 'Paracetamol', 'Pain reliever 500mg', 'Analgesics', 39.00, 10, 10, 39.00, 3.90, 0.39, 1000, 'box', 1, '2027-12-31'),
            ('Brufen', 'Ibuprofen', 'Anti-inflammatory 400mg', 'Analgesics', 55.00, 10, 10, 55.00, 5.50, 0.55, 500, 'box', 1, '2027-08-15'),
            ('Amoxil', 'Amoxicillin', 'Antibiotic 250mg', 'Antibiotics', 250.00, 10, 10, 250.00, 25.00, 2.50, 300, 'box', 1, '2027-06-30'),
            ('Zyrtec', 'Cetirizine', 'Antihistamine 10mg', 'Allergy', 32.00, 10, 10, 32.00, 3.20, 0.32, 400, 'box', 1, '2028-03-25'),
            ('Ceevit', 'Ascorbic Acid', 'Vitamin C 1000mg supplement', 'Vitamins', 65.00, 10, 10, 65.00, 6.50, 0.65, 800, 'box', 1, '2028-01-10')
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