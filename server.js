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

const DEFAULT_CATEGORY_UNITS = {
    unit_levels: 1,
    level_1_name: 'Unit',
    level_2_name: null,
    level_3_name: null,
    conversion_1_to_2: null,
    conversion_2_to_3: null
};

const toNullablePositiveInt = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeCategoryUnits = (payload = {}) => {
    const unitLevelsRaw = payload.unit_levels ?? DEFAULT_CATEGORY_UNITS.unit_levels;
    const unitLevels = Number.parseInt(unitLevelsRaw, 10);

    if (!Number.isInteger(unitLevels) || unitLevels < 1 || unitLevels > 3) {
        return { error: 'unit_levels must be 1, 2, or 3' };
    }

    const level1 = (payload.level_1_name ?? '').toString().trim();
    const level2 = (payload.level_2_name ?? '').toString().trim();
    const level3 = (payload.level_3_name ?? '').toString().trim();

    if (!level1) {
        return { error: 'level_1_name is required' };
    }

    if (unitLevels >= 2 && !level2) {
        return { error: 'level_2_name is required when unit_levels is 2 or 3' };
    }

    if (unitLevels >= 3 && !level3) {
        return { error: 'level_3_name is required when unit_levels is 3' };
    }

    const conversion1to2 = toNullablePositiveInt(payload.conversion_1_to_2);
    const conversion2to3 = toNullablePositiveInt(payload.conversion_2_to_3);

    if (unitLevels >= 2 && conversion1to2 === null) {
        return { error: 'conversion_1_to_2 is required and must be a positive integer when unit_levels is 2 or 3' };
    }

    if (unitLevels >= 3 && conversion2to3 === null) {
        return { error: 'conversion_2_to_3 is required and must be a positive integer when unit_levels is 3' };
    }

    return {
        value: {
            unit_levels: unitLevels,
            level_1_name: level1,
            level_2_name: unitLevels >= 2 ? level2 : null,
            level_3_name: unitLevels >= 3 ? level3 : null,
            conversion_1_to_2: unitLevels >= 2 ? conversion1to2 : null,
            conversion_2_to_3: unitLevels >= 3 ? conversion2to3 : null
        }
    };
};

const ensureCategorySchemaColumns = async () => {
    const columns = await db.all(`PRAGMA table_info(categories)`);
    const existing = new Set(columns.map((col) => col.name));
    const migrations = [
        { name: 'unit_levels', sql: 'ALTER TABLE categories ADD COLUMN unit_levels INTEGER DEFAULT 1' },
        { name: 'level_1_name', sql: "ALTER TABLE categories ADD COLUMN level_1_name TEXT" },
        { name: 'level_2_name', sql: "ALTER TABLE categories ADD COLUMN level_2_name TEXT" },
        { name: 'level_3_name', sql: "ALTER TABLE categories ADD COLUMN level_3_name TEXT" },
        { name: 'conversion_1_to_2', sql: 'ALTER TABLE categories ADD COLUMN conversion_1_to_2 INTEGER' },
        { name: 'conversion_2_to_3', sql: 'ALTER TABLE categories ADD COLUMN conversion_2_to_3 INTEGER' }
    ];

    for (const migration of migrations) {
        if (!existing.has(migration.name)) {
            await db.exec(migration.sql);
        }
    }

    // Ensure old rows have usable defaults.
    await db.run(`
        UPDATE categories
        SET
            unit_levels = COALESCE(unit_levels, 1),
            level_1_name = COALESCE(NULLIF(TRIM(level_1_name), ''), 'Unit')
    `);
};

    const ensureSalesSchemaColumns = async () => {
        const columns = await db.all(`PRAGMA table_info(sales)`);
        const existing = new Set(columns.map((col) => col.name));
        const migrations = [
            { name: 'amount_received', sql: 'ALTER TABLE sales ADD COLUMN amount_received REAL DEFAULT 0' },
            { name: 'change_return', sql: 'ALTER TABLE sales ADD COLUMN change_return REAL DEFAULT 0' }
        ];

        for (const migration of migrations) {
            if (!existing.has(migration.name)) {
                await db.exec(migration.sql);
            }
        }
    };

// Update the database initialization
async function initializeDatabase() {
    try {
        db = await open({
            filename: path.join(process.cwd(), 'pharmacy.db'),
            driver: sqlite3.Database
        });

        // Initialize final 2026 database schema
        await db.exec(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                unit_levels INTEGER NOT NULL,
                level_1_name TEXT NOT NULL,
                level_2_name TEXT,
                level_3_name TEXT,
                conversion_1_to_2 INTEGER,
                conversion_2_to_3 INTEGER
            );

            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                generic_name TEXT,
                category_id INTEGER,
                price_per_box REAL,
                price_per_strip REAL,
                price_per_tablet REAL,
                base_stock INTEGER,
                FOREIGN KEY (category_id) REFERENCES categories (id)
            );

            CREATE TABLE IF NOT EXISTS sales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                total REAL NOT NULL,
                subtotal REAL NOT NULL,
                discount REAL DEFAULT 0,
                amount_received REAL DEFAULT 0,
                change_return REAL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sale_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                qty INTEGER NOT NULL,
                line_total REAL NOT NULL,
                FOREIGN KEY (sale_id) REFERENCES sales (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            );

            CREATE TABLE IF NOT EXISTS returns (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sale_id INTEGER,
                product_id INTEGER,
                return_qty_base INTEGER,
                refund_amount REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sale_id) REFERENCES sales (id),
                FOREIGN KEY (product_id) REFERENCES products (id)
            );
        `);

        await ensureCategorySchemaColumns();
        await ensureSalesSchemaColumns();

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
            const products = await db.all(`
                SELECT 
                    p.id,
                    p.name,
                    p.generic_name,
                    p.category_id,
                    COALESCE(p.price_per_box, 0) AS price_per_box,
                    COALESCE(p.price_per_strip, 0) AS price_per_strip,
                    COALESCE(p.price_per_tablet, 0) AS price_per_tablet,
                    COALESCE(p.base_stock, 0) AS base_stock,
                    c.name AS category_name,
                    c.unit_levels,
                    c.level_1_name,
                    c.level_2_name,
                    c.level_3_name,
                    c.conversion_1_to_2,
                    c.conversion_2_to_3
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
            `);
            res.json(products.map(product => ({
                id: product.id,
                name: product.name,
                generic_name: product.generic_name,
                category_id: product.category_id,
                category_name: product.category_name || 'Uncategorized',
                price_per_box: product.price_per_box,
                price_per_strip: product.price_per_strip,
                price_per_tablet: product.price_per_tablet,
                base_stock: product.base_stock,
                unit_levels: product.unit_levels || DEFAULT_CATEGORY_UNITS.unit_levels,
                level_1_name: product.level_1_name || DEFAULT_CATEGORY_UNITS.level_1_name,
                level_2_name: product.level_2_name || null,
                level_3_name: product.level_3_name || null,
                conversion_1_to_2: product.conversion_1_to_2 || null,
                conversion_2_to_3: product.conversion_2_to_3 || null,
                unit_config: {
                    unit_levels: product.unit_levels || DEFAULT_CATEGORY_UNITS.unit_levels,
                    level_1_name: product.level_1_name || DEFAULT_CATEGORY_UNITS.level_1_name,
                    level_2_name: product.level_2_name || null,
                    level_3_name: product.level_3_name || null,
                    conversion_1_to_2: product.conversion_1_to_2 || null,
                    conversion_2_to_3: product.conversion_2_to_3 || null
                }
            })));
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // Update the POST products endpoint
    app.post('/api/products', async (req, res) => {
        try {
            const {
                name,
                generic_name,
                category_id,
                price_per_box,
                price_per_strip,
                price_per_tablet,
                base_stock
            } = req.body;

            // Validate input
            if (!name) {
                return res.status(400).json({ message: 'Product name is required' });
            }

            const result = await db.run(`
                INSERT INTO products (
                    name,
                    generic_name,
                    category_id,
                    price_per_box,
                    price_per_strip,
                    price_per_tablet,
                    base_stock
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
                name,
                generic_name || null,
                category_id || null,
                price_per_box || null,
                price_per_strip || null,
                price_per_tablet || null,
                base_stock || 0
            ]);

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
            const requestedBaseStock = req.body.base_stock ?? req.body.stock;
            const productId = req.params.id;

            if (requestedBaseStock === undefined) {
                return res.status(400).json({ message: 'base_stock quantity is required' });
            }

            // First get the current product to ensure it exists.
            const product = await db.get('SELECT * FROM products WHERE id = ?', [productId]);
            
            if (!product) {
                return res.status(404).json({ message: 'Product not found' });
            }

            // Update base_stock as the canonical inventory value.
            await db.run('UPDATE products SET base_stock = ? WHERE id = ?', [requestedBaseStock, productId]);

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
            const {
                name,
                generic_name,
                category_id,
                price_per_box,
                price_per_strip,
                price_per_tablet,
                base_stock
            } = req.body;
            const id = req.params.id;

            // Validate input
            if (!name) {
                return res.status(400).json({ message: 'Product name is required' });
            }

            // Update the product
            await db.run(`
                UPDATE products 
                SET name = ?, generic_name = ?, category_id = ?, price_per_box = ?, price_per_strip = ?, price_per_tablet = ?, base_stock = ?
                WHERE id = ?
            `, [
                name,
                generic_name || null,
                category_id || null,
                price_per_box || null,
                price_per_strip || null,
                price_per_tablet || null,
                base_stock || 0,
                id
            ]);

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
            const categories = await db.all(`SELECT * FROM categories ORDER BY name ASC`);
            res.json(categories);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/api/categories', async (req, res) => {
        try {
            const { name } = req.body;
            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Category name is required' });
            }

            const normalized = normalizeCategoryUnits(req.body);
            if (normalized.error) {
                return res.status(400).json({ error: normalized.error });
            }

            const units = normalized.value;

            const result = await db.run(
                `INSERT INTO categories (
                    name,
                    unit_levels,
                    level_1_name,
                    level_2_name,
                    level_3_name,
                    conversion_1_to_2,
                    conversion_2_to_3
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    name.trim(),
                    units.unit_levels,
                    units.level_1_name,
                    units.level_2_name,
                    units.level_3_name,
                    units.conversion_1_to_2,
                    units.conversion_2_to_3
                ]
            );
            const category = await db.get('SELECT * FROM categories WHERE id = ?', result.lastID);
            res.status(201).json(category);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    app.put('/api/categories/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;

            const existing = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
            if (!existing) {
                return res.status(404).json({ error: 'Category not found' });
            }

            if (!name || !name.trim()) {
                return res.status(400).json({ error: 'Category name is required' });
            }

            const normalized = normalizeCategoryUnits(req.body);
            if (normalized.error) {
                return res.status(400).json({ error: normalized.error });
            }
            const units = normalized.value;

            await db.run(
                `UPDATE categories
                 SET
                    name = ?,
                    unit_levels = ?,
                    level_1_name = ?,
                    level_2_name = ?,
                    level_3_name = ?,
                    conversion_1_to_2 = ?,
                    conversion_2_to_3 = ?
                 WHERE id = ?`,
                [
                    name.trim(),
                    units.unit_levels,
                    units.level_1_name,
                    units.level_2_name,
                    units.level_3_name,
                    units.conversion_1_to_2,
                    units.conversion_2_to_3,
                    id
                ]
            );

            // Category name changes don't affect products since we now use category_id (foreign key)

            const updated = await db.get('SELECT * FROM categories WHERE id = ?', [id]);
            res.json(updated);
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
            const products = await db.get('SELECT COUNT(*) as count FROM products WHERE category_id = ?', id);
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
        const { items, total, subtotal, discount, amount_received, change_return } = req.body;
        
        try {
            // Begin transaction
            await db.run('BEGIN TRANSACTION');
            
            // Insert sale
            const saleResult = await db.run(`
                INSERT INTO sales (total, subtotal, discount, amount_received, change_return, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
            `, [total, subtotal, discount || 0, amount_received || 0, change_return || 0]);
            
            const saleId = saleResult.lastID;
            
            // Insert sale items
            for (const item of items) {
                await db.run(`
                    INSERT INTO sale_items (sale_id, product_id, qty, line_total)
                    VALUES (?, ?, ?, ?)
                `, [saleId, item.product_id, item.qty, item.line_total]);

                // Deduct sold quantity from base_stock (smallest unit inventory).
                await db.run(
                    'UPDATE products SET base_stock = MAX(base_stock - ?, 0) WHERE id = ?',
                    [item.qty, item.product_id]
                );
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

    app.post('/api/sales/return', async (req, res) => {
        const { items } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Returned items array is required'
            });
        }

        let totalRefunded = 0;

        try {
            await db.run('BEGIN TRANSACTION');

            for (const item of items) {
                const { sale_id, product_id, return_qty_base, refund_amount } = item;

                if (!sale_id || !product_id || return_qty_base === undefined || refund_amount === undefined) {
                    throw new Error('Each return item must include sale_id, product_id, return_qty_base, and refund_amount');
                }

                await db.run(
                    `INSERT INTO returns (sale_id, product_id, return_qty_base, refund_amount)
                     VALUES (?, ?, ?, ?)`,
                    [sale_id, product_id, return_qty_base, refund_amount]
                );

                await db.run(
                    'UPDATE products SET base_stock = base_stock + ? WHERE id = ?',
                    [return_qty_base, product_id]
                );

                const updatedProduct = await db.get('SELECT * FROM products WHERE id = ?', [product_id]);
                if (updatedProduct) {
                    notifyClients('product_update', { product: updatedProduct });
                }

                totalRefunded += Number(refund_amount) || 0;
            }

            await db.run('COMMIT');

            res.status(200).json({
                success: true,
                message: 'Return processed successfully',
                total_refunded: totalRefunded
            });
        } catch (error) {
            await db.run('ROLLBACK');
            console.error('Error processing return:', error);
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
            const sales = await db.all(`
                SELECT
                    id,
                    total,
                    subtotal,
                    discount,
                    amount_received,
                    change_return,
                    created_at,
                    created_at AS date
                FROM sales
                ORDER BY created_at DESC
            `);
            
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

