import React, { useState, useEffect } from 'react';
import './App.css';

// Local products catalog mapping default inventory
const CATALOG = [
  { id: "prod_001", name: "Classic Indigo Denim Jacket", category: "Outerwear", price: 89.99, image: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=400&q=80", rating: 4.8, description: "Heavyweight denim jacket featuring metal buttons and adjustable cuffs. Timeless style." },
  { id: "prod_002", name: "Premium Knit Crewneck Sweater", category: "Tops", price: 65.00, image: "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=400&q=80", rating: 4.6, description: "Soft cotton-blend knit sweater with ribbed cuffs and neckband. Relaxed fit." },
  { id: "prod_003", name: "Tailored Linen Summer Shirt", category: "Tops", price: 48.50, image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=400&q=80", rating: 4.5, description: "Ultralight, breathable linen blend button-down. Perfect for warm-weather styles." },
  { id: "prod_004", name: "Stretch Utility Cargo Pants", category: "Bottoms", price: 72.00, image: "https://images.unsplash.com/photo-1517423568366-8b83523034fd?auto=format&fit=crop&w=400&q=80", rating: 4.7, description: "Durable stretch ripstop material with multiple cargo storage pockets. Comfort fit." },
  { id: "prod_005", name: "Minimalist Leather Court Sneaker", category: "Shoes", price: 110.00, image: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=400&q=80", rating: 4.9, description: "Full-grain calfskin leather sneaker with orthotic insoles and durable vulcanized soles." }
];

export default function App() {
  const [products, setProducts] = useState(CATALOG);
  const [cart, setCart] = useState([]);
  const [view, setView] = useState('store/front'); // store/front, store/cart, portal
  const [apiEndpoint, setApiEndpoint] = useState('https://cq4nugmim3.execute-api.us-east-1.amazonaws.com/production');
  const [isConfiguringEndpoint, setIsConfiguringEndpoint] = useState(false);

  // Form checkout fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cvv, setCvv] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('12');
  const [expiryYear, setExpiryYear] = useState('2030');

  // Checkout loading/result state
  const [checkoutModal, setCheckoutModal] = useState(false);
  const [checkoutProgress, setCheckoutProgress] = useState(null); // 'validate', 'risk', 'process', 'receipt', 'notify', 'done', 'error'
  const [checkoutStatusText, setCheckoutStatusText] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);

  // Transactions ledger list
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetchProducts();
    fetchTransactions();
  }, [apiEndpoint]);

  const fetchProducts = async () => {
    if (!apiEndpoint) {
      setProducts(CATALOG);
      return;
    }
    try {
      const res = await fetch(`${apiEndpoint}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.warn("Could not fetch live products catalog from API. Using local default catalog.", e);
      setProducts(CATALOG);
    }
  };

  const fetchTransactions = async () => {
    if (!apiEndpoint) {
      // Seed default transactions for local mock view
      setTransactions([
        { transactionId: "tx_mock_1", merchantId: "mch_safepay_clothing", amount: 154.99, currency: "USD", cardLast4: "4312", status: "SUCCESS", riskScore: 0.12, createdAt: new Date(Date.now() - 3600000).toISOString() },
        { transactionId: "tx_mock_2", merchantId: "mch_safepay_clothing", amount: 12000.00, currency: "USD", cardLast4: "9999", status: "DECLINED_FRAUD", riskScore: 0.94, createdAt: new Date(Date.now() - 7200000).toISOString() }
      ]);
      return;
    }
    try {
      const res = await fetch(`${apiEndpoint}/transactions`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (e) {
      console.error("Failed to fetch transactions from live database.", e);
    }
  };

  const addToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.qty), 0);

  // Trigger payments sending payloads to API Gateway or running the local visual AWS simulation
  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();

    if (cart.length === 0) return;

    setCheckoutModal(true);
    setPaymentResult(null);

    const payload = {
      transactionId: `tx_${Math.random().toString(36).substring(2, 11)}`,
      transaction: {
        merchantId: "mch_safepay_clothing",
        amount: parseFloat(cartTotal.toFixed(2)),
        currency: "USD",
        card: {
          cardNumber: cardNumber.replace(/\s+/g, ''),
          cvv,
          expiryMonth: parseInt(expiryMonth),
          expiryYear: parseInt(expiryYear)
        },
        timestamp: new Date().toISOString()
      },
      clientIp: "99.231.10.15" // Mock IP
    };

    // Live API integration mode
    if (apiEndpoint) {
      try {
        setCheckoutProgress('validate');
        setCheckoutStatusText('Ingesting request and validating payment tokens via API Gateway...');

        const res = await fetch(`${apiEndpoint}/charge`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || 'Validation error');
        }

        const data = await res.json();
        // Since API Gateway responds immediately, we poll or display success
        setCheckoutProgress('done');
        setCheckoutStatusText('Payment processed successfully. Execution created!');
        setPaymentResult({
          transactionId: payload.transactionId,
          status: 'PROCESSING',
          arn: data.executionArn,
          amount: cartTotal.toFixed(2),
          currency: 'USD'
        });
        setCart([]);
        fetchTransactions();
      } catch (err) {
        setCheckoutProgress('error');
        setCheckoutStatusText(`Checkout Failed: ${err.message}`);
      }
      return;
    }

    // Local AWS Simulation Mode
    runMockAwsPipeline(payload);
  };

  const runMockAwsPipeline = (payload) => {
    const last4 = payload.transaction.card.cardNumber.slice(-4);
    const amount = payload.transaction.amount;

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

    (async () => {
      // 1. Validation
      setCheckoutProgress('validate');
      setCheckoutStatusText('[Step 1/5] API Gateway Invoked. Activating ValidateTransaction Lambda...');
      await delay(1200);

      // Check card expiry inputs
      if (parseInt(expiryYear) < new Date().getFullYear()) {
        setCheckoutProgress('error');
        setCheckoutStatusText('[Error] Validation failed: Credit card has expired.');
        return;
      }

      // 2. Bedrock AI Scoring
      setCheckoutProgress('risk');
      setCheckoutStatusText('[Step 2/5] ValidateTransaction OK. Triggering Bedrock AI Risk Scoring...');
      await delay(1500);

      let riskScore = 0.12;
      let riskStatus = "APPROVED";
      let justification = "Shopper history is consistent. Location match verified.";

      if (amount > 1000) {
        riskScore = 0.54;
        riskStatus = "REVIEW_REQUIRED";
        justification = "Elevated order checkout size. Requires settlement review.";
      }
      if (last4 === "9999" || amount > 50000) {
        riskScore = 0.95;
        riskStatus = "DENIED_FRAUD";
        justification = "AI identified high-risk card matching velocity charge flags.";
      }

      setCheckoutStatusText(`[Bedrock Analysis] Status: ${riskStatus} (Score: ${riskScore})...`);
      await delay(1000);

      // If extreme fraud, branch directly to receipt / block
      if (riskStatus === "DENIED_FRAUD") {
        setCheckoutProgress('receipt');
        setCheckoutStatusText('[Step 4/5] Risk is high. Aborting checkout card call. Archiving receipt logs...');
        await delay(1200);

        setCheckoutProgress('notify');
        setCheckoutStatusText('[Step 5/5] Publishing fraud callback logs to SNS for merchant notification...');
        await delay(1000);

        setCheckoutProgress('done');
        setCheckoutStatusText('Payment Orchestration Finished.');
        setPaymentResult({
          transactionId: payload.transactionId,
          status: 'DECLINED_FRAUD',
          riskScore,
          justification,
          amount: amount.toFixed(2),
          currency: 'USD',
          createdAt: new Date().toISOString()
        });
        // Append log to simulated database
        setTransactions(prev => [
          { transactionId: payload.transactionId, merchantId: "mch_safepay_clothing", amount, currency: "USD", cardLast4: last4, status: "DECLINED_FRAUD", riskScore, createdAt: new Date().toISOString() },
          ...prev
        ]);
        return;
      }

      // 3. Process Card call
      setCheckoutProgress('process');
      setCheckoutStatusText('[Step 3/5] Fraud Check Approved. Contacting Visa/Mastercard simulation network...');
      await delay(1500);

      let status = "SUCCESS";
      if (last4 === "1111") {
        status = "DECLINED_INSUFFICIENT_FUNDS";
      }

      // 4. Archive Receipt
      setCheckoutProgress('receipt');
      setCheckoutStatusText('[Step 4/5] Payment Authorized. Archiving order receipt JSON in S3 bucket and DynamoDB...');
      await delay(1200);

      // 5. Notify Merchant
      setCheckoutProgress('notify');
      setCheckoutStatusText('[Step 5/5] Triggering NotifyMerchant Lambda. Publishing email alert via SNS...');
      await delay(1000);

      setCheckoutProgress('done');
      setCheckoutStatusText('Orchestration state machine finished successfully.');
      setPaymentResult({
        transactionId: payload.transactionId,
        status,
        riskScore,
        justification,
        amount: amount.toFixed(2),
        currency: 'USD',
        receiptUrl: `s3://safepay-receipts-archive/receipts/mch_safepay_clothing/${payload.transactionId}.json`,
        createdAt: new Date().toISOString()
      });

      setTransactions(prev => [
        { transactionId: payload.transactionId, merchantId: "mch_safepay_clothing", amount, currency: "USD", cardLast4: last4, status, riskScore, createdAt: new Date().toISOString() },
        ...prev
      ]);
      setCart([]);
    })();
  };

  return (
    <div className="min-h-screen">
      {/* Top Navbar */}
      <nav className="glass-panel sticky top-0 z-30 mx-auto my-4 max-w-7xl px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView('store/front')}>
          <span className="text-xl font-extrabold tracking-tight gradient-text">ThreadCare</span>
          <span className="text-xs bg-indigo-900/50 border border-indigo-700 px-2 py-0.5 rounded-full text-indigo-300">Serverless E-Store</span>
        </div>

        <div className="flex items-center gap-6">
          <button 
            className={`text-sm font-semibold transition ${view.startsWith('store') ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => setView('store/front')}
          >
            Storefront
          </button>
          <button 
            className={`text-sm font-semibold transition ${view === 'portal' ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'}`}
            onClick={() => { setView('portal'); fetchTransactions(); }}
          >
            Merchant Panel
          </button>
          <div className="h-4 w-px bg-slate-800"></div>
          <button 
            className="relative p-2 text-slate-400 hover:text-slate-200 transition"
            onClick={() => setView(view === 'store/cart' ? 'store/front' : 'store/cart')}
          >
            🛒
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white pulse">
                {cart.reduce((s, i) => s + i.qty, 0)}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-4 py-8">
        
        {/* Settings Box: API Configuration */}
        <div className="glass-panel p-4 mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-300">AWS Integration Setup</h3>
            <p className="text-xs text-slate-400">
              {apiEndpoint 
                ? `Connected to live API Gateway: ${apiEndpoint}` 
                : 'Running in Local AWS Emulator (Step Functions & Bedrock are fully simulated visually).'}
            </p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            {isConfiguringEndpoint ? (
              <>
                <input 
                  type="text" 
                  placeholder="https://abc123xyz.execute-api.us-east-1.amazonaws.com/production"
                  className="bg-slate-900 border border-slate-700 text-xs px-3 py-1.5 rounded w-full md:w-80 text-slate-200"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                />
                <button 
                  className="bg-sky-600 text-white text-xs px-3 py-1.5 rounded hover:bg-sky-500 font-semibold"
                  onClick={() => setIsConfiguringEndpoint(false)}
                >
                  Save
                </button>
              </>
            ) : (
              <button 
                className="bg-slate-800 border border-slate-700 text-xs px-3 py-1.5 rounded text-slate-300 hover:bg-slate-700 font-semibold"
                onClick={() => setIsConfiguringEndpoint(true)}
              >
                Configure AWS Endpoint
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Views */}
        {view === 'store/front' && (
          <div>
            {/* Banner */}
            <div className="glass-panel p-8 mb-12 flex flex-col items-center text-center">
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">
                Elevate Your <span className="gradient-text">Wardrobe</span>
              </h1>
              <p className="text-sm md:text-md text-slate-400 max-w-2xl">
                Shop premium, sustainably sourced apparel with lightning-fast checkout powered by serverless cloud compute and real-time AI security.
              </p>
            </div>

            {/* Products grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map((prod) => (
                <div key={prod.id} className="glass-card flex flex-col h-full overflow-hidden">
                  <div className="h-64 overflow-hidden relative">
                    <img src={prod.image} alt={prod.name} className="w-full h-full object-cover hover:scale-105 transition duration-500" />
                    <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur border border-slate-700 text-[10px] px-2 py-0.5 rounded-full text-slate-300 font-bold uppercase tracking-wider">
                      {prod.category}
                    </span>
                  </div>
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-lg text-slate-100">{prod.name}</h3>
                      <span className="font-bold text-sky-400">${prod.price.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-4">
                      <span className="text-yellow-400">★</span>
                      <span className="text-xs text-slate-400 font-semibold">{prod.rating}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-6 flex-grow">{prod.description}</p>
                    <button 
                      className="w-full bg-indigo-600/90 border border-indigo-500 text-white py-2.5 rounded-lg hover:bg-indigo-600 transition font-bold text-sm"
                      onClick={() => addToCart(prod)}
                    >
                      Add To Cart
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'store/cart' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart Items */}
            <div className="lg:col-span-2 glass-panel p-6">
              <h2 className="text-2xl font-bold mb-6">Shopping Cart</h2>
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <p className="mb-4">Your shopping cart is empty.</p>
                  <button className="text-sky-400 font-bold" onClick={() => setView('store/front')}>Go back to store</button>
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {cart.map((item) => (
                    <div key={item.id} className="flex justify-between items-center border-b border-slate-800 pb-6">
                      <div className="flex gap-4">
                        <img src={item.image} alt={item.name} className="w-16 h-16 rounded object-cover" />
                        <div>
                          <h4 className="font-semibold text-slate-200">{item.name}</h4>
                          <p className="text-xs text-slate-500">Qty: {item.qty} × ${item.price.toFixed(2)}</p>
                        </div>
                      </div>
                      <button className="text-rose-500 text-xs font-semibold" onClick={() => removeFromCart(item.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkout Form */}
            <div className="glass-panel p-6 h-fit">
              <h3 className="text-xl font-bold mb-6">Payment Checkout</h3>
              <form onSubmit={handleCheckoutSubmit}>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Full Name</label>
                  <input type="text" required placeholder="John Doe" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Email Address</label>
                  <input type="email" required placeholder="johndoe@example.com" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">Card Number</label>
                  <input type="text" required placeholder="4111 2222 3333 4444" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" value={cardNumber} onChange={e => setCardNumber(e.target.value)} />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Try ending in <b>9999</b> for NSF fraud decline, or <b>1111</b> for card decline.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Exp Month</label>
                    <input type="number" min="1" max="12" placeholder="12" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" value={expiryMonth} onChange={e => setExpiryMonth(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">Exp Year</label>
                    <input type="number" placeholder="2030" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" value={expiryYear} onChange={e => setExpiryYear(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1.5">CVV</label>
                    <input type="text" required placeholder="123" className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm" value={cvv} onChange={e => setCvv(e.target.value)} />
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4 mb-6 flex justify-between">
                  <span className="font-semibold text-slate-400">Total Price</span>
                  <span className="font-bold text-xl text-sky-400">${cartTotal.toFixed(2)}</span>
                </div>
                <button 
                  type="submit" 
                  disabled={cart.length === 0}
                  className="w-full bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold py-3 rounded-lg hover:from-sky-400 hover:to-indigo-500 transition disabled:opacity-50 text-sm"
                >
                  Pay Securely via SafePay
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Merchant Audit Panel View */}
        {view === 'portal' && (
          <div className="glass-panel p-6">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-bold">SafePay Merchant Transaction Auditing Ledger</h2>
                <p className="text-slate-400 text-xs mt-1">Real-time order statuses, fraud metrics, and Bedrock AI justifications.</p>
              </div>
              <button 
                className="bg-indigo-600 text-white text-xs px-4 py-2 rounded font-bold hover:bg-indigo-500"
                onClick={fetchTransactions}
              >
                Refresh Data
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-4 px-3">Transaction ID</th>
                    <th className="py-4 px-3">Date</th>
                    <th className="py-4 px-3">Card Last4</th>
                    <th className="py-4 px-3">Amount</th>
                    <th className="py-4 px-3">Risk Score</th>
                    <th className="py-4 px-3">Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500">No transaction records found.</td>
                    </tr>
                  ) : (
                    transactions.map((tx) => (
                      <tr key={tx.transactionId} className="border-b border-slate-800 hover:bg-slate-900/30 transition">
                        <td className="py-4 px-3 font-mono font-bold text-sky-400">{tx.transactionId}</td>
                        <td className="py-4 px-3 text-slate-400">{new Date(tx.createdAt).toLocaleString()}</td>
                        <td className="py-4 px-3 font-mono text-slate-300">xxxx-xxxx-xxxx-{tx.cardLast4}</td>
                        <td className="py-4 px-3 font-bold text-slate-200">${parseFloat(tx.amount).toFixed(2)}</td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded font-bold font-mono text-[10px] ${
                            tx.riskScore > 0.8 ? 'bg-red-950 text-red-300 border border-red-800' :
                            tx.riskScore > 0.4 ? 'bg-yellow-950 text-yellow-300 border border-yellow-800' :
                            'bg-green-950 text-green-300 border border-green-800'
                          }`}>
                            {(tx.riskScore * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-4 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.status === 'SUCCESS' ? 'bg-green-950 text-green-400 border border-green-900' :
                            tx.status.startsWith('DECLINED_FRAUD') ? 'bg-red-950 text-red-400 border border-red-900' :
                            'bg-yellow-950 text-yellow-400 border border-yellow-900'
                          }`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Checkout Processing Overlay Modal */}
      {checkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg p-8 flex flex-col">
            
            <h3 className="text-xl font-bold mb-6 text-center">AWS Payment Orchestration Pipeline</h3>

            {/* AWS Simulated Progression */}
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex items-center gap-4 text-sm">
                <span className={`w-3 h-3 rounded-full ${checkoutProgress === 'validate' ? 'bg-sky-500 pulse' : ['risk', 'process', 'receipt', 'notify', 'done'].includes(checkoutProgress) ? 'bg-green-500' : 'bg-slate-800'}`}></span>
                <span className={checkoutProgress === 'validate' ? 'text-sky-400 font-bold' : ['risk', 'process', 'receipt', 'notify', 'done'].includes(checkoutProgress) ? 'text-green-400' : 'text-slate-400'}>
                  1. Input Schema Validation
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`w-3 h-3 rounded-full ${checkoutProgress === 'risk' ? 'bg-sky-500 pulse' : ['process', 'receipt', 'notify', 'done'].includes(checkoutProgress) ? 'bg-green-500' : checkoutProgress === 'done' && paymentResult?.status === 'DECLINED_FRAUD' ? 'bg-red-500' : 'bg-slate-800'}`}></span>
                <span className={checkoutProgress === 'risk' ? 'text-sky-400 font-bold' : ['process', 'receipt', 'notify', 'done'].includes(checkoutProgress) ? 'text-green-400' : checkoutProgress === 'done' && paymentResult?.status === 'DECLINED_FRAUD' ? 'text-red-400 font-bold' : 'text-slate-400'}>
                  2. Bedrock AI Fraud Scoring
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`w-3 h-3 rounded-full ${checkoutProgress === 'process' ? 'bg-sky-500 pulse' : ['receipt', 'notify', 'done'].includes(checkoutProgress) ? 'bg-green-500' : 'bg-slate-800'}`}></span>
                <span className={checkoutProgress === 'process' ? 'text-sky-400 font-bold' : ['receipt', 'notify', 'done'].includes(checkoutProgress) ? 'text-green-400' : 'text-slate-400'}>
                  3. Card Processor Settlement
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`w-3 h-3 rounded-full ${checkoutProgress === 'receipt' ? 'bg-sky-500 pulse' : ['notify', 'done'].includes(checkoutProgress) ? 'bg-green-500' : 'bg-slate-800'}`}></span>
                <span className={checkoutProgress === 'receipt' ? 'text-sky-400 font-bold' : ['notify', 'done'].includes(checkoutProgress) ? 'text-green-400' : 'text-slate-400'}>
                  4. S3 Receipt & DynamoDB Logging
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className={`w-3 h-3 rounded-full ${checkoutProgress === 'notify' ? 'bg-sky-500 pulse' : checkoutProgress === 'done' ? 'bg-green-500' : 'bg-slate-800'}`}></span>
                <span className={checkoutProgress === 'notify' ? 'text-sky-400 font-bold' : checkoutProgress === 'done' ? 'text-green-400' : 'text-slate-400'}>
                  5. SNS Webhook Callbacks
                </span>
              </div>
            </div>

            {/* Status box */}
            <div className="bg-slate-900 border border-slate-800 rounded p-4 text-xs font-mono text-slate-300 mb-6">
              {checkoutStatusText}
            </div>

            {/* Result box */}
            {paymentResult && (
              <div className="border-t border-slate-800 pt-6 flex flex-col gap-3">
                <h4 className="font-bold text-center text-md mb-2">Orchestration Report</h4>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Order ID:</span>
                  <span className="font-mono font-bold text-sky-400">{paymentResult.transactionId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Amount Charged:</span>
                  <span className="font-bold text-slate-200">${paymentResult.amount} {paymentResult.currency}</span>
                </div>
                {paymentResult.riskScore !== undefined && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Fraud Assessment:</span>
                    <span className="font-bold text-slate-200">{(paymentResult.riskScore * 100).toFixed(0)}% (Bedrock AI)</span>
                  </div>
                )}
                {paymentResult.justification && (
                  <div className="text-xs bg-slate-950 p-2 rounded text-slate-400 border border-slate-800 leading-relaxed">
                    <b>AI Justification:</b> {paymentResult.justification}
                  </div>
                )}
                <div className="flex justify-between text-xs items-center mt-2">
                  <span className="text-slate-400">Settlement Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    paymentResult.status === 'SUCCESS' ? 'bg-green-950 text-green-400 border border-green-900' :
                    paymentResult.status.startsWith('DECLINED_FRAUD') ? 'bg-red-950 text-red-400 border border-red-900' :
                    'bg-yellow-950 text-yellow-400 border border-yellow-900'
                  }`}>
                    {paymentResult.status}
                  </span>
                </div>
                {paymentResult.receiptUrl && (
                  <div className="text-[10px] font-mono text-slate-500 mt-2 text-center">
                    Invoice archived: {paymentResult.receiptUrl}
                  </div>
                )}
                <button 
                  className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2.5 rounded-lg text-xs mt-4 transition"
                  onClick={() => { setCheckoutModal(false); setView('store/front'); }}
                >
                  Close Pipeline Panel
                </button>
              </div>
            )}

            {checkoutProgress === 'error' && (
              <button 
                className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-2.5 rounded-lg text-xs mt-4 transition"
                onClick={() => setCheckoutModal(false)}
              >
                Close and Retry
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
