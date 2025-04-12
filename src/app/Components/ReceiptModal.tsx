"use client";

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { FaPrint, FaTimes } from 'react-icons/fa';
import { defaultSettings, StoreSettings } from './StoreSettings';

interface CartItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    unit: string;
}

interface ReceiptModalProps {
    items: CartItem[];
    discount: number;
    calculateSubtotal: () => string;
    calculateTotal: () => string;
    handlePrint: () => void;
    onClose: () => void;
    saveSale: () => Promise<boolean>;
    orderNumber?: string; // Order number prop - this will be the actual database ID
}

const printStyles = `
  @media print {
    @page {
      size: 80mm auto;
      margin: 0mm;
    }
    
    body * {
      visibility: hidden;
    }
    
    .receipt-modal, .receipt-modal * {
      visibility: visible;
    }
    
    .receipt-modal {
      position: absolute !important;
      left: 0 !important;
      top: 0 !important;
      width: 80mm !important;
      padding: 0 !important;
      margin: 0 !important;
      overflow: visible !important;
      height: auto !important;
      max-height: none !important;
      background: white !important;
      box-shadow: none !important;
    }
    
    .receipt-content {
      height: auto !important;
      max-height: none !important;
      overflow: visible !important;
      padding: 5mm !important;
      font-size: 12px !important;
    }
    
    .no-print {
      display: none !important;
    }
    
    /* Professional receipt styles */
    .receipt-header {
      text-align: center !important;
      margin-bottom: 10px !important;
    }
    
    .receipt-header h1 {
      font-size: 18px !important;
      font-weight: bold !important;
      margin-bottom: 2px !important;
    }
    
    .receipt-header p {
      margin: 2px 0 !important;
      font-size: 10px !important;
    }
    
    .receipt-divider {
      border-top: 1px dashed #000 !important;
      margin: 5px 0 !important;
    }
    
    .receipt-table {
      width: 100% !important;
      border-collapse: collapse !important;
      font-size: 10px !important;
    }
    
    .receipt-table th {
      border-bottom: 1px solid #000 !important;
      padding-bottom: 2px !important;
      font-weight: bold !important;
    }
    
    .receipt-table td {
      padding: 2px 0 !important;
    }
    
    .receipt-totals {
      margin-top: 5px !important;
      padding-top: 5px !important;
      border-top: 1px dashed #000 !important;
    }
    
    .receipt-bold {
      font-weight: bold !important;
    }
    
    .receipt-footer {
      margin-top: 10px !important;
      text-align: center !important;
      font-size: 10px !important;
    }
  }
`;

const ReceiptModal = ({
    items,
    discount,
    calculateSubtotal,
    calculateTotal,
    handlePrint,
    onClose,
    saveSale,
    orderNumber
}: ReceiptModalProps) => {
    const [mounted, setMounted] = useState(false);
    const [clientDate] = useState(() => new Date().toLocaleDateString());
    const [clientTime] = useState(() => new Date().toLocaleTimeString());
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [storeSettings, setStoreSettings] = useState<StoreSettings>(defaultSettings);

    // Load store settings
    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem('storeSettings');
            if (savedSettings) {
                setStoreSettings(JSON.parse(savedSettings));
            }
        } catch (err) {
            console.error('Error loading store settings:', err);
        }
    }, []);

    // Listen for store settings updates
    useEffect(() => {
        const handleSettingsUpdate = (event: CustomEvent<StoreSettings>) => {
            setStoreSettings(event.detail);
        };
        
        window.addEventListener('storeSettingsUpdated', handleSettingsUpdate as EventListener);
        
        return () => {
            window.removeEventListener('storeSettingsUpdated', handleSettingsUpdate as EventListener);
        };
    }, []);

    // Format price helper function
    const formatPrice = (price: number | string): string => {
        const numberPrice = typeof price === 'string' ? parseFloat(price) : price;
        return !isNaN(numberPrice) ? numberPrice.toFixed(2) : '0.00';
    };

    const handleSaveAndPrint = async () => {
        try {
            setIsSaving(true);
            const success = await saveSale();
            if (success) {
                setTimeout(() => {
                    printReceipt();
                }, 300); // Increased timeout for better reliability
            } else {
                throw new Error('Failed to save sale');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save sale');
        } finally {
            setIsSaving(false);
        }
    };

    const printReceipt = useCallback(() => {
        // Create a new window for professional receipt printing
        const printWin = window.open('', '_blank');
        if (printWin) {
            // Create a more professional receipt template
            printWin.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Sales Receipt</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        @page {
                            size: 80mm auto;
                            margin: 0;
                        }
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 10mm 5mm;
                            width: 70mm;
                            font-size: 12px;
                            background: white;
                        }
                        .receipt-header {
                            text-align: center;
                            margin-bottom: 10px;
                        }
                        .receipt-header h2 {
                            font-size: 18px;
                            margin-bottom: 5px;
                            color: #000;
                        }
                        .receipt-header p {
                            margin: 2px 0;
                            font-size: 10px;
                            color: #333;
                        }
                        .divider {
                            border-top: 1px dashed #000;
                            margin: 5px 0;
                        }
                        .order-details {
                            margin: 10px 0;
                            text-align: center;
                        }
                        .order-number {
                            font-weight: bold;
                            font-size: 14px;
                            background-color: #f3f3f3;
                            padding: 5px;
                            border-radius: 3px;
                        }
                        .date-line {
                            display: flex;
                            justify-content: space-between;
                            margin: 5px 0;
                            font-size: 10px;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 10px;
                        }
                        th {
                            text-align: left;
                            border-bottom: 1px solid #000;
                            padding: 3px 0;
                        }
                        th:nth-child(2), td:nth-child(2),
                        th:nth-child(3), td:nth-child(3),
                        th:nth-child(4), td:nth-child(4) {
                            text-align: right;
                        }
                        td {
                            padding: 3px 0;
                        }
                        .totals {
                            margin-top: 10px;
                            text-align: right;
                        }
                        .total-line {
                            display: flex;
                            justify-content: space-between;
                        }
                        .grand-total {
                            font-weight: bold;
                            margin-top: 5px;
                            padding-top: 5px;
                            border-top: 1px dashed #000;
                        }
                        .footer {
                            margin-top: 15px;
                            text-align: center;
                            font-size: 10px;
                        }
                    </style>
                </head>
                <body>
                    <div class="receipt-header">
                        <h2>${storeSettings.storeName}</h2>
                        <p>${storeSettings.storeAddress}</p>
                        <p>Phone: ${storeSettings.storePhone}</p>
                        ${storeSettings.storeEmail ? `<p>Email: ${storeSettings.storeEmail}</p>` : ''}
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="date-line">
                        <span>Date: ${clientDate}</span>
                        <span>Time: ${clientTime}</span>
                    </div>
                    
                    <div class="order-details">
                        <div class="order-number">Order #: ${orderNumber || 'N/A'}</div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => `
                                <tr>
                                    <td>${item.name}</td>
                                    <td>${item.qty} ${item.unit}</td>
                                    <td>${storeSettings.currency} ${parseFloat(item.price.toString()).toFixed(2)}</td>
                                    <td>${storeSettings.currency} ${(item.qty * item.price).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    
                    <div class="totals">
                        <div class="total-line">
                            <span>Subtotal:</span>
                            <span>${storeSettings.currency} ${calculateSubtotal()}</span>
                        </div>
                        <div class="total-line">
                            <span>Discount:</span>
                            <span>${storeSettings.currency} ${parseFloat(discount.toString()).toFixed(2)}</span>
                        </div>
                        ${storeSettings.taxRate > 0 ? `
                        <div class="total-line">
                            <span>Tax (${storeSettings.taxRate}%):</span>
                            <span>${storeSettings.currency} ${((parseFloat(calculateTotal()) * storeSettings.taxRate) / 100).toFixed(2)}</span>
                        </div>
                        ` : ''}
                        <div class="total-line grand-total">
                            <span>Total:</span>
                            <span>${storeSettings.currency} ${calculateTotal()}</span>
                        </div>
                    </div>
                    
                    <div class="divider"></div>
                    
                    <div class="footer">
                        ${storeSettings.receiptFooter.split('\n').map(line => `<p>${line}</p>`).join('')}
                        <p><b>Order #: ${orderNumber || 'N/A'}</b></p>
                    </div>
                    
                    <script>
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    </script>
                </body>
                </html>
            `);
            printWin.document.close();
        }
        onClose();
    }, [items, discount, calculateSubtotal, calculateTotal, orderNumber, clientDate, clientTime, onClose, storeSettings]);

    useEffect(() => {
        setMounted(true);
        
        // Add print styles
        const style = document.createElement('style');
        style.textContent = printStyles;
        document.head.appendChild(style);

        return () => {
            if (style.parentNode) {
                style.parentNode.removeChild(style);
            }
        };
    }, []);

    // Add keyboard handler effect
    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    handleSaveAndPrint();
                    break;
                case 'Escape':
                    e.preventDefault();
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [handleSaveAndPrint, onClose]);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 flex items-center justify-center z-50">
            {error && (
                <div className="absolute top-4 right-4 bg-red-100 text-red-600 p-2 rounded">
                    {error}
                </div>
            )}
            <div className="fixed inset-0 bg-black opacity-50 no-print" onClick={onClose}></div>
            <div className="receipt-modal bg-white  rounded-lg relative  shadow-xl" style={{ width: '400px', maxHeight: '600px' }}>
                {/* Header */}
                <div className="p-4 border-b border-gray-200 no-print">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-teal-700">Receipt</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 no-print">
                            <FaTimes size={20} />
                        </button>
                    </div>
                </div>

                {/* Receipt Content */}
                <div className="receipt-content p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                    <div className="receipt-header text-center mb-4">
                        <div className=' justify-items-center'> <img src={storeSettings.logo} className='h-12' /></div>
                       
                        <h1 className="text-xl font-bold text-teal-700">{storeSettings.storeName}</h1>
                        <p className="text-sm text-gray-800">{storeSettings.storeAddress}</p>
                        <p className="text-xs text-gray-800">Phone: {storeSettings.storePhone}</p>
                        {storeSettings.storeEmail && 
                            <p className="text-xs text-gray-800">Email: {storeSettings.storeEmail}</p>
                        }
                    </div>

                    <div className="receipt-divider border-t border-dashed border-gray-300"></div>

                    <div className="flex justify-between text-xs text-gray-800 mb-2">
                        <p>Date: {clientDate}</p>
                        <p>Time: {clientTime}</p>
                    </div>
                    
                    {/* Order Number - Using the raw database ID */}
                    <div className="text-center mb-2 bg-gray-300 py-1 rounded">
                        <p className="font-bold text-gray-800">Order #: {orderNumber}</p>
                    </div>
                    
                    <div className="receipt-divider border-t border-dashed border-gray-300"></div>

                    <table className="receipt-table w-full text-sm">
                        <thead>
                            <tr>
                                <th className="text-left text-gray-800">Item</th>
                                <th className="text-right text-gray-800">Qty</th>
                                <th className="text-right text-gray-800">Price</th>
                                <th className="text-right text-gray-800">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index} className="border-b border-dotted text-gray-800 border-gray-300">
                                    <td className="py-1">{item.name}</td>
                                    <td className="text-right py-1">
                                        {item.qty} {item.unit}
                                    </td>
                                    <td className="text-right py-1">{storeSettings.currency} {formatPrice(item.price)}</td>
                                    <td className="text-right py-1">{storeSettings.currency} {formatPrice(item.price * item.qty)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div className="receipt-totals space-y-1 text-sm mb-4 mt-2 text-gray-800">
                        <div className="flex justify-between">
                            <p className="font-medium ">Subtotal:</p>
                            <p>{storeSettings.currency} {calculateSubtotal()}</p>
                        </div>
                        <div className="flex justify-between">
                            <p className="font-medium">Discount:</p>
                            <p>{storeSettings.currency} {formatPrice(discount)}</p>
                        </div>
                        {storeSettings.taxRate > 0 && (
                            <div className="flex justify-between">
                                <p className="font-medium">Tax ({storeSettings.taxRate}%):</p>
                                <p>{storeSettings.currency} {((parseFloat(calculateTotal()) * storeSettings.taxRate) / 100).toFixed(2)}</p>
                            </div>
                        )}
                        <div className="receipt-divider border-t border-dashed border-gray-300 text-gray-800"></div>
                        <div className="flex justify-between receipt-bold font-bold">
                            <p>Total:</p>
                            <p>{storeSettings.currency} {calculateTotal()}</p>
                        </div>
                    </div>

                    <div className="receipt-divider border-t border-dashed border-gray-300"></div>

                    <div className="receipt-footer text-center text-xs text-gray-800 mt-6">
                        {storeSettings.receiptFooter.split('\n').map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                        <p className="mt-3 receipt-bold font-bold">Order #: {orderNumber}</p>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-white sticky bottom-0 no-print">
                    <div className="flex justify-between">
                        <button
                            onClick={handleSaveAndPrint}
                            onKeyDown={handleSaveAndPrint}
                            disabled={isSaving}
                            className={`px-4 py-2 ${isSaving ? 'bg-gray-400' : 'bg-teal-600'} text-white rounded-lg flex items-center hover:bg-teal-700 transition-colors`}
                        >
                            {isSaving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FaPrint className="mr-2" />
                                    Print Receipt
                                </>
                            )}
                        </button>
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default dynamic(() => Promise.resolve(ReceiptModal), { ssr: false });