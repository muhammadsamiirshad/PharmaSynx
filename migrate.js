const { Pool } = require('pg');
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Sale = require('./models/Sale');

async function migrate() {
    try {
        // Connect to both databases
        const pool = new Pool({
            connectionString: process.env.NEON_DB_URL || 'postgresql://rms:npg_6yap5PwZtLHR@ep-holy-smoke-a5bfisrw-pooler.us-east-2.aws.neon.tech/rms?sslmode=require',
            ssl: { rejectUnauthorized: false }
        });
        
        await mongoose.connect('mongodb://localhost:27017/rms', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        // Clear existing MongoDB collections
        await Promise.all([
            Category.deleteMany({}),
            Product.deleteMany({}),
            Sale.deleteMany({})
        ]);

        // Migrate categories
        console.log('Migrating categories...');
        const categories = await pool.query('SELECT * FROM categories');
        const categoryMap = new Map(); // To store category id mappings

        for (const cat of categories.rows) {
            const newCategory = await Category.create({
                name: cat.name,
                description: cat.description
            });
            categoryMap.set(cat.id, newCategory._id);
            console.log(`Migrated category: ${cat.name}`);
        }

        // Migrate products
        console.log('Migrating products...');
        const products = await pool.query(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
        `);
        const productMap = new Map(); // To store product id mappings

        for (const prod of products.rows) {
            const newProduct = await Product.create({
                name: prod.name,
                description: prod.description,
                category: categoryMap.get(prod.category_id),
                price: Math.max(0, parseFloat(prod.price) || 0),
                stock: Math.max(0, parseInt(prod.stock) || 0),
                unit: prod.unit,
                defaultQty: Math.max(1, parseInt(prod.default_qty) || 1),
                barcodes: Array.isArray(prod.barcodes) ? prod.barcodes : []
            });
            productMap.set(prod.id, newProduct._id);
            console.log(`Migrated product: ${prod.name}`);
        }

        // Migrate sales
        console.log('Migrating sales...');
        const sales = await pool.query('SELECT * FROM sales');
        
        for (const sale of sales.rows) {
            const saleItems = await pool.query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);
            
            await Sale.create({
                items: await Promise.all(saleItems.rows.map(async item => ({
                    product: productMap.get(item.product_id),
                    quantity: Math.max(0, parseInt(item.quantity) || 0),
                    price: Math.max(0, parseFloat(item.price) || 0),
                    name: item.name,
                    unit: item.unit
                }))),
                total: Math.max(0, parseFloat(sale.total) || 0),
                subtotal: Math.max(0, parseFloat(sale.subtotal) || 0),
                discount: Math.max(0, parseFloat(sale.discount) || 0),
                date: new Date(sale.date)
            });
            console.log(`Migrated sale: ${sale.id}`);
        }

        console.log('Migration completed successfully');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        await pool.end();
    }
}

migrate().catch(console.error);