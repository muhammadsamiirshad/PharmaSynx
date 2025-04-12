const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Add this after your existing imports
const clients = new Set();

// Initialize SQLite database
let db;

// Update the database initialization
async function initializeDatabase() {
    try {
        db = await open({
            filename: path.join(__dirname, 'pharmacy.db'),
            driver: sqlite3.Database
        });

        // Create products table with category as a simple column
        await db.exec(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT, /* Changed from category_id to category text */
                price REAL NOT NULL,
                stock INTEGER DEFAULT 0,
                unit TEXT NOT NULL,
                default_qty INTEGER DEFAULT 1,
                photo TEXT,
                expiry_date TEXT
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total REAL NOT NULL,
                subtotal REAL NOT NULL,
                discount REAL DEFAULT 0,
                date TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                product_id INTEGER,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                name TEXT NOT NULL,
                unit TEXT NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
        `);

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
        process.exit(1);
    }
}

// Initialize database before starting server
initializeDatabase().then(() => {
    // Products API
    app.get('/api/products', async (req, res) => {
        try {
            const products = await db.all('SELECT * FROM products');
            res.json(products.map(product => ({
                ...product,
                category: product.category || 'Uncategorized'
            })));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update the POST products endpoint
    app.post('/api/products', async (req, res) => {
        try {
            const { name, description, category, price, stock, unit, defaultQty, photo, expiry_date } = req.body;

            // Validate input
            if (!name || price === undefined) {
                return res.status(400).json({ message: 'Name and price are required' });
            }

            // Format the expiry date correctly (if provided)
            const expiry_date_formatted = expiry_date || null;

            const result = await db.run(`
                INSERT INTO products (name, description, category, price, stock, unit, default_qty, photo, expiry_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [name, description, category, price, stock || 0, unit, defaultQty || 1, photo, expiry_date_formatted]);

            const newProduct = await db.get('SELECT * FROM products WHERE id = ?', [result.lastID]);
            
            // Notify clients about the new product
            notifyClients('product_update', { product: newProduct });

            res.status(201).json(newProduct);
        } catch (err) {
            console.error('Error adding product:', err);
            res.status(500).json({ message: 'Failed to add product', error: err.message });
        }
    });

    // Update this endpoint
    app.put('/api/products/:id/stock', async (req, res) => {
        try {
            const { stock } = req.body;
            const productId = req.params.id;

            if (stock === undefined) {
                return res.status(400).json({ message: 'Stock quantity is required' });
            }

            // First get the current product to know its stock
            const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
            
            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Update stock
            await db.run('UPDATE products SET stock = ? WHERE id = ?', [stock, productId]);

            // Get the updated product
            const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
            
            // Notify clients about the update
            notifyClients('product_update', { product: updatedProduct });

            res.json(updatedProduct);
        } catch (err) {
            console.error('Error updating product stock:', err);
            res.status(500).json({ message: 'Failed to update product stock', error: err.message });
        }
    });

    // Update the PUT products/:id endpoint
    app.put('/api/products/:id', async (req, res) => {
        try {
            const { name, description, category, price, stock, unit, defaultQty, photo, expiry_date } = req.body;
            const id = req.params.id;

            // Validate input
            if (!name || price === undefined) {
                return res.status(400).json({ message: 'Name and price are required' });
            }

            // Format the expiry date correctly (if provided)
            const expiry_date_formatted = expiry_date || null;

            // Update the product
            await db.run(`
                UPDATE products 
                SET name = ?, description = ?, category = ?, price = ?, stock = ?, unit = ?, default_qty = ?, photo = ?, expiry_date = ?
                WHERE id = ?
            `, [name, description, category, price, stock, unit, defaultQty, photo, expiry_date_formatted, id]);

            // Fetch the updated product
            const product = await db.get('SELECT * FROM products WHERE id = ?', [id]);
            
            if (!product) {
                return res.status(404).json({ message: 'Product not found after update' });
            }

            // Notify clients about the product update
            notifyClients('product_update', { product });

            res.status(200).json(product);
        } catch (err) {
            console.error('Error updating product:', err);
            res.status(500).json({ message: 'Failed to update product', error: err.message });
        }
    });

    app.delete('/api/products/:id', async (req, res) => {
        try {
            const { id } = req.params;

            // Check if product exists
            const product = await db.get('SELECT * FROM products WHERE id = ?', id);
            if (!product) {
                return res.status(404).json({ error: 'Product not found' });
            }

            // Delete the product
            await db.run('DELETE FROM products WHERE id = ?', id);

            notifyClients('product_deleted', { id: req.params.id });

            res.json({ success: true, message: 'Product deleted successfully' });
        } catch (err) {
            console.error('Delete product error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Categories API
    app.get('/api/categories', async (req, res) => {
        try {
            const categories = await db.all('SELECT * FROM categories');
            res.json(categories);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/categories', async (req, res) => {
        try {
            const { name, description } = req.body;
            const result = await db.run(
                'INSERT INTO categories (name, description) VALUES (?, ?)',
                [name, description]
            );
            const category = await db.get('SELECT * FROM categories WHERE id = ?', result.lastID);
            res.status(201).json(category);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.delete('/api/categories/:id', async (req, res) => {
        try {
            const { id } = req.params;

            // Check if category exists
            const category = await db.get('SELECT * FROM categories WHERE id = ?', id);
            if (!category) {
                return res.status(404).json({ error: 'Category not found' });
            }

            // Check if category has products
            const products = await db.get('SELECT COUNT(*) as count FROM products WHERE category = ?', category.name);
            if (products.count > 0) {
                return res.status(400).json({ 
                    error: 'Cannot delete category with associated products' 
                });
            }

            // Delete the category
            await db.run('DELETE FROM categories WHERE id = ?', id);

            res.json({ success: true, message: 'Category deleted successfully' });
        } catch (err) {
            console.error('Delete category error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Sales API
    app.post('/api/sales', async (req, res) => {
        const { items, total, subtotal, discount } = req.body;
        
        try {
            // Begin transaction
            await db.run('BEGIN TRANSACTION');
            
            // Insert sale
            const saleResult = await db.run(`
                INSERT INTO sales (total, subtotal, discount, date)
                VALUES (?, ?, ?, datetime('now', 'localtime'))
            `, [total, subtotal, discount || 0]);
            
            const saleId = saleResult.lastID;
            
            // Insert sale items
            for (const item of items) {
                await db.run(`
                    INSERT INTO sale_items (sale_id, product_id, quantity, price, name, unit)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, [saleId, item.product_id, item.quantity, item.price, item.name, item.unit]);
                
                // Update product stock if needed (this could also be done client-side)
                // const product = await db.get('SELECT stock FROM products WHERE id = ?', item.product_id);
                // if (product) {
                //     const newStock = Math.max(0, product.stock - item.quantity);
                //     await db.run('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);
                // }
            }
            
            // Commit transaction
            await db.run('COMMIT');
            
            // Send back the sale ID
            res.status(201).json({ 
                success: true, 
                message: 'Sale created successfully', 
                id: saleId 
            });
        } catch (error) {
            // Rollback on error
            await db.run('ROLLBACK');
            console.error('Error creating sale:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // Add this before your routes
    app.get('/api/products/updates', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        clients.add(res);
        
        req.on('close', () => {
            clients.delete(res);
        });
    });

    // Add this endpoint to your server.js file if it's not already there
    app.get('/api/sales', async (req, res) => {
        try {
            const sales = await db.all('SELECT * FROM sales ORDER BY date DESC');
            
            // For each sale, get its items
            for (const sale of sales) {
                const items = await db.all('SELECT * FROM sale_items WHERE sale_id = ?', [sale.id]);
                sale.items = items;
            }
            
            res.json(sales);
        } catch (err) {
            console.error('Fetch sales error:', err);
            res.status(500).json({ error: err.message });
        }
    });

    // Add this temporary route to server.js to check your database schema
    app.get('/api/debug/schema', async (req, res) => {
        try {
            const tableInfo = await db.all(`PRAGMA table_info(products)`);
            const sampleProduct = await db.get(`SELECT * FROM products LIMIT 1`);
            res.json({ 
                tableSchema: tableInfo,
                sampleProduct: sampleProduct,
                expiryDateType: sampleProduct ? typeof sampleProduct.expiry_date : 'unknown'
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update the data reset endpoint to handle specific tabs
    app.post('/api/reset-data', async (req, res) => {
        try {
            const { tabType } = req.body;
            
            // Validate tab type
            const validTabs = ['overview', 'sales', 'inventory', 'stock', 'reports', 'alerts', 'all'];
            if (!validTabs.includes(tabType)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid tab type. Must be one of: ' + validTabs.join(', ')
                });
            }
            
            // Handle different tab types
            if (tabType === 'all' || tabType === 'overview') {
                // Delete all data (original behavior)
                await db.run('DELETE FROM sale_items');
                await db.run('DELETE FROM sales');
                await db.run('DELETE FROM products');
                await db.run('DELETE FROM sqlite_sequence WHERE name IN (\'products\', \'sales\', \'sale_items\')');
                
                // Notify clients that all data has been reset
                notifyClients('data_reset', { message: 'All data has been cleared', type: 'all' });
            } else if (tabType === 'sales') {
                // Delete only sales data
                await db.run('DELETE FROM sale_items');
                await db.run('DELETE FROM sales');
                await db.run('DELETE FROM sqlite_sequence WHERE name IN (\'sales\', \'sale_items\')');
                
                // Notify clients that sales data has been reset
                notifyClients('data_reset', { message: 'Sales data has been cleared', type: 'sales' });
            } else if (tabType === 'inventory' || tabType === 'stock' || tabType === 'alerts') {
                // Delete only product data
                await db.run('DELETE FROM products');
                await db.run('DELETE FROM sqlite_sequence WHERE name = \'products\'');
                
                // Notify clients that inventory data has been reset
                notifyClients('data_reset', { message: 'Inventory data has been cleared', type: 'inventory' });
            }
            
            res.status(200).json({ 
                success: true, 
                message: `${tabType === 'all' ? 'All' : tabType} data has been cleared successfully` 
            });
        } catch (err) {
            console.error('Error resetting database:', err);
            res.status(500).json({ 
                success: false, 
                message: 'Failed to clear data', 
                error: err.message 
            });
        }
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
});

// Add this function after your routes
function notifyClients(eventType, data) {
    const eventData = JSON.stringify({ type: eventType, data });
    clients.forEach(client => {
        client.write(`data: ${eventData}\n\n`);
    });
}

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
    });
});

