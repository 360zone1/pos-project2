const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Ab aapka server seedhe aapke Supabase database se connect hoga.
const pool = new Pool({
    connectionString: "postgresql://postgres.lymnyzzluqrjgwbfnhrk:MyNetworkSupabasedb1@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres",
});

// Products fetch karne ka API
app.get('/api/products', (req, res) => {
    pool.query('SELECT * FROM products', (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Database mein masla hua.');
        }
        res.json(results.rows);
    });
});

// Naya product add karne ka API
app.post('/api/products', (req, res) => {
    const { name, price, stock } = req.body;
    const query = 'INSERT INTO products (name, price, stock) VALUES ($1, $2, $3) RETURNING *';
    pool.query(query, [name, price, stock], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Product add karne mein masla hua.');
        }
        res.status(201).json(results.rows[0]);
    });
});

// Stock reset karne ka naya API
app.put('/api/products/reset-stock', (req, res) => {
    const resetStockQuery = 'UPDATE products SET stock = 100';
    pool.query(resetStockQuery, (error, results) => {
        if (error) {
            console.error("Error resetting stock:", error);
            return res.status(500).json({ message: 'Stock reset process mein masla hua.' });
        }
        res.status(200).json({ message: 'All product stock has been reset to 100.' });
    });
});

// Product ka stock update karne ka API
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { stock } = req.body;
    const query = 'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *';
    pool.query(query, [stock, id], (error, results) => {
        if (error) {
            console.error("Error updating stock:", error);
            return res.status(500).json({ message: 'Stock update karne mein masla hua.' });
        }
        if (results.rows.length === 0) {
            return res.status(404).json({ message: 'Product nahi mila.' });
        }
        res.status(200).json(results.rows[0]);
    });
});


// Naya order process karne ka API
app.post('/api/orders', async (req, res) => {
    const { order, totalAmount, discount } = req.body;
    if (!order || order.length === 0) {
        return res.status(400).json({ message: "Order khali hai, pehle kuch products add karen." });
    }

    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        const insertOrderQuery = 'INSERT INTO orders (total_amount, discount) VALUES ($1, $2) RETURNING id';
        const orderResult = await client.query(insertOrderQuery, [totalAmount, discount]);
        const orderId = orderResult.rows[0].id;

        for (const item of order) {
            const productQuery = 'SELECT stock FROM products WHERE id = $1';
            const productResult = await client.query(productQuery, [item.id]);
            const product = productResult.rows[0];

            if (product.stock < item.quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `${item.name} out of stock hai. Sirf ${product.stock} pieces baqi hain.` });
            }

            const updateStockQuery = 'UPDATE products SET stock = stock - $1 WHERE id = $2';
            await client.query(updateStockQuery, [item.quantity, item.id]);

            const insertOrderItemQuery = 'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES ($1, $2, $3, $4, $5)';
            await client.query(insertOrderItemQuery, [orderId, item.id, item.name, item.quantity, item.price]);
        }

        await client.query('COMMIT');
        res.status(201).json({ message: 'Order successful!' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error processing order:', error);
        res.status(500).json({ message: 'Payment process mein masla hua.' });
    } finally {
        client.release();
    }
});

// Orders fetch karne ka API
app.get('/api/orders', (req, res) => {
    pool.query('SELECT * FROM orders ORDER BY created_at DESC', (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Orders fetch karne mein masla hua.');
        }
        res.json(results.rows);
    });
});

// Order details fetch karne ka API
app.get('/api/orders/:id', (req, res) => {
    const orderId = req.params.id;
    const query = `
        SELECT o.id, o.total_amount, o.discount, o.created_at, oi.product_name AS name, oi.quantity, oi.price
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.id = $1
    `;
    pool.query(query, [orderId], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).send('Order details fetch karne mein masla hua.');
        }
        if (results.rows.length === 0) {
            return res.status(404).send('Order nahi mila.');
        }

        const order = {
            id: results.rows[0].id,
            total_amount: results.rows[0].total_amount,
            discount: results.rows[0].discount,
            created_at: results.rows[0].created_at,
            items: results.rows.map(row => ({
                name: row.name,
                quantity: row.quantity,
                price: row.price
            }))
        };
        res.json(order);
    });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});