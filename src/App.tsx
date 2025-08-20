import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css'; // Yeh line zaroori hai
import type { Product, OrderItem } from './types';

// Naye types define karen
type Order = {
  id: number;
  total_amount: string;
  discount: string;
  created_at: string;
};

type FullOrderDetails = Order & {
    items: OrderItem[];
};

function App() {
  const [isOrderPanelOpen, setIsOrderPanelOpen] = useState(true);
  const [order, setOrder] = useState<OrderItem[]>([]);
  const [cashReceived, setCashReceived] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountPercentage, setDiscountPercentage] = useState(0);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductStock, setNewProductStock] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');

  const [activeView, setActiveView] = useState('sales');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<FullOrderDetails | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const fetchProducts = async () => {
    try {
      const response = await axios.get('/api/products');
      setProducts(response.data);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await axios.get('/api/orders');
      setOrders(response.data);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const fetchOrderDetails = async (orderId: number) => {
    try {
        const response = await axios.get(`/api/orders/${orderId}`);
        const itemsWithParsedPrice = response.data.items.map((item: any) => ({
            ...item,
            price: parseFloat(item.price)
        }));
        
        setSelectedOrder({
            ...response.data,
            items: itemsWithParsedPrice
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        setSelectedOrder(null);
    }
  };
  
  const handleResetStock = async () => {
    const confirmation = window.confirm("Kya aap waqai sab products ka stock reset karna chahte hain? Stock 100 par set ho jayega.");
    if (confirmation) {
      try {
        const response = await axios.put('http://localhost:5000/api/products/reset-stock');
        setPaymentMessage(response.data.message);
        fetchProducts();
      } catch (error) {
        console.error("Error resetting stock:", error);
        setPaymentMessage("Stock reset karne mein masla hua.");
      }
    }
  };
  
  const handleUpdateStock = async (id: number) => {
    const newStock = prompt('Naya stock daalen:');
    if (newStock === null || isNaN(parseInt(newStock))) {
        return; // User cancelled or entered invalid number
    }
    try {
        await axios.put(`http://localhost:5000/api/products/${id}`, {
            stock: parseInt(newStock)
        });
        setPaymentMessage('Stock update ho gaya!');
        fetchProducts(); // Refresh products list
    } catch (error) {
        console.error("Error updating stock:", error);
        setPaymentMessage("Stock update karne mein masla hua.");
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchOrders();
  }, []);

  const handleAddProduct = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newProductName || !newProductPrice || !newProductStock) return;
    try {
      await axios.post('http://localhost:5000/api/products', {
        name: newProductName,
        price: parseFloat(newProductPrice),
        stock: parseInt(newProductStock)
      });
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('');
      fetchProducts();
    } catch (error) {
      console.error("Error adding product:", error);
    }
  };
  
  const handleAddToOrder = (product: Product) => {
    if (product.stock <= 0) {
      setPaymentMessage("Yeh product out of stock hai.");
      return;
    }

    setOrder(prevOrder => {
      const existingItem = prevOrder.find(item => item.id === product.id);
      if (existingItem) {
        return prevOrder.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevOrder, { 
          ...product, 
          price: parseFloat(product.price), 
          quantity: 1 
        }];
      }
    });
  };

  const handleApplyDiscount = () => {
    const currentSubTotal = order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setDiscount(currentSubTotal * (discountPercentage / 100));
  };
  
  const handleClearDiscount = () => {
    setDiscount(0);
    setDiscountPercentage(0);
  };

  const handleProcessPayment = async () => {
    if (order.length === 0) {
      setPaymentMessage("Order khali hai, pehle kuch products add karen.");
      return;
    }
    const finalTotal = totalAmount < 0 ? 0 : totalAmount;
    if (cashReceived < finalTotal) {
      setPaymentMessage("Cash Received Total Amount se kam hai.");
      return;
    }

    try {
      await axios.post('http://localhost:5000/api/orders', {
        order,
        totalAmount: finalTotal,
        discount,
      });

      const change = cashReceived - finalTotal;
      setPaymentMessage(`Payment successful!\nTotal: ${finalTotal.toFixed(2)} SAR\nCash Received: ${cashReceived.toFixed(2)} SAR\nChange: ${change.toFixed(2)} SAR\nDiscount Applied: -${discount.toFixed(2)} SAR (${discountPercentage}%)`);

      setOrder([]);
      setCashReceived(0);
      setDiscount(0);
      setDiscountPercentage(0);
      fetchOrders();
      fetchProducts(); 
    } catch (error) {
      if (axios.isAxiosError(error) && error.response && error.response.data && error.response.data.message) {
        setPaymentMessage(error.response.data.message);
      } else {
        setPaymentMessage("Payment process mein masla hua.");
      }
      console.error(error);
    }
  };
  
  const handleRemoveFromOrder = (id: number) => {
    setOrder(prevOrder => prevOrder.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      handleRemoveFromOrder(id);
    } else {
      setOrder(prevOrder =>
        prevOrder.map(item =>
          item.id === id ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const subTotal = order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalAmount = subTotal - discount;
  const changeDue = cashReceived > totalAmount ? cashReceived - totalAmount : 0;

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="pos-layout">
      <aside className="sidebar">
        <div className="logo">POS Application</div>
        <nav>
          <ul>
            <li onClick={() => setActiveView('sales')}>Sales Terminal</li>
            <li onClick={() => setActiveView('orders')}>Orders</li>
            <li>Reports</li>
            <li>Settings</li>
          </ul>
        </nav>
      </aside>

      {activeView === 'sales' && (
        <main className="main-content">
          <header className="main-header">
            <h2>Sales Terminal</h2>
            <div className="user-info">
              <span>User: Mohsin Khan</span>
            </div>
          </header>

          <section className="product-area">
            <h3>Add New Product</h3>
            <form onSubmit={handleAddProduct} className="add-product-form">
              <input 
                type="text" 
                placeholder="Product Name" 
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                required
              />
              <input 
                type="number" 
                placeholder="Price" 
                value={newProductPrice}
                onChange={(e) => setNewProductPrice(e.target.value)}
                required
              />
              <input 
                type="number" 
                placeholder="Stock" 
                value={newProductStock}
                onChange={(e) => setNewProductStock(e.target.value)}
                required
              />
              <button type="submit">Add Product</button>
              <button type="button" onClick={handleResetStock}>Reset All Stock</button>
            </form>
            
            <div className="search-bar-container">
              <input 
                type="text"
                placeholder="Search products..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <h3>Product Catalog</h3>
            <div className="product-grid">
              {filteredProducts.map(product => (
                <div 
                  key={product.id} 
                  className={`product-card ${product.stock <= 0 ? 'out-of-stock' : product.stock < 5 ? 'low-stock' : ''}`}
                  onClick={() => handleAddToOrder(product)}
                >
                  <div>{product.name}</div>
                  <div>{parseFloat(product.price).toFixed(2)} SAR</div>
                  <div className="product-stock">Stock: {product.stock}</div>
                  {product.stock <= 0 && (
                      <button 
                          className="update-stock-btn"
                          onClick={(e) => {
                              e.stopPropagation(); // Yeh zaroori hai taake card click na ho
                              handleUpdateStock(product.id);
                          }}
                      >
                          Update Stock
                      </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {activeView === 'orders' && (
        <main className="main-content">
          <header className="main-header">
            <h2>All Orders</h2>
          </header>
          {selectedOrder ? (
              <div className="order-details-view">
                  <button onClick={() => setSelectedOrder(null)} className="back-btn">← Back to Orders</button>
                  <h3>Order #{selectedOrder.id}</h3>
                  <p>Date: {new Date(selectedOrder.created_at).toLocaleString()}</p>
                  <p>Total: {parseFloat(selectedOrder.total_amount).toFixed(2)} SAR</p>
                  <p>Discount: {parseFloat(selectedOrder.discount).toFixed(2)} SAR</p>
                  <h4>Items:</h4>
                  <ul>
                      {selectedOrder.items.map((item, index) => (
                          <li key={index}>
                              {item.name} (Qty: {item.quantity}) - {item.price.toFixed(2)} SAR each
                          </li>
                      ))}
                  </ul>
              </div>
          ) : (
              <div className="orders-list">
                  <table>
                      <thead>
                          <tr>
                              <th>Order ID</th>
                              <th>Date</th>
                              <th>Total Amount</th>
                              <th>Discount</th>
                              <th>Action</th>
                          </tr>
                      </thead>
                      <tbody>
                          {orders.map(order => (
                              <tr key={order.id}>
                                  <td>{order.id}</td>
                                  <td>{new Date(order.created_at).toLocaleDateString()}</td>
                                  <td>{parseFloat(order.total_amount).toFixed(2)} SAR</td>
                                  <td>{parseFloat(order.discount).toFixed(2)} SAR</td>
                                  <td><button onClick={() => fetchOrderDetails(order.id)}>View Details</button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          )}
        </main>
      )}
      
      {activeView === 'sales' && (
        <aside className={`right-panel ${isOrderPanelOpen ? 'open' : ''}`}>
          <div className="order-summary">
            <div className="order-header">
              <h3>Current Order</h3>
              <button className="close-btn" onClick={() => setIsOrderPanelOpen(false)}>X</button>
            </div>
            <ul className="order-list">
              {order.map(item => (
                <li key={item.id} className="order-item">
                  <div className="item-details">
                    {item.name}
                    <span className="item-price"> ({item.price.toFixed(2)} SAR each)</span>
                  </div>
                  <div className="item-controls">
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}>-</button>
                    <span className="item-quantity">{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}>+</button>
                    <button className="remove-btn" onClick={() => handleRemoveFromOrder(item.id)}>X</button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="totals-section">
              <div className="sub-total">Subtotal: {subTotal.toFixed(2)} SAR</div>
              {discount > 0 && (
                <>
                  <div className="discount-line">Discount: -{discount.toFixed(2)} SAR ({discountPercentage}%)</div>
                  <button onClick={handleClearDiscount} className="clear-discount-btn">Clear Discount</button>
                </>
              )}
              
              <div className="discount-input-group">
                  <input 
                      type="text"
                      placeholder="Discount %"
                      value={discountPercentage}
                      onChange={e => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                  />
                  <button 
                      onClick={handleApplyDiscount} 
                      className="apply-discount-btn"
                  >
                      Apply Discount
                  </button>
              </div>

              <div className="total-amount">Total: {totalAmount.toFixed(2)} SAR</div>
            </div>
            
            <div className="payment-section">
              <label htmlFor="cashReceived">Cash Received:</label>
              <input 
                type="text"
                id="cashReceived"
                value={cashReceived}
                onChange={e => setCashReceived(parseFloat(e.target.value) || 0)}
              />
              <div className="change-due">Change: {changeDue.toFixed(2)} SAR</div>
            </div>
            <button 
              className="checkout-btn"
              onClick={handleProcessPayment}
            >
              Process Payment
            </button>
            {paymentMessage && (
              <div className="payment-message">
                {paymentMessage.split('\n').map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

export default App;