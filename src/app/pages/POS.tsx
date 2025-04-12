"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { FaMinusCircle, FaPlusCircle, FaImage, FaTimes, FaSearch } from "react-icons/fa";
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import ReceiptModal from "../Components/ReceiptModal";
import KeyboardShortcuts from '../Components/KeyboardShortcuts';
import Toast from "../Components/Toast";

// Define interfaces
interface Product {
    id: string;
    name: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    unit: string;
    defaultQty: number;
    photo: string | null;
    expiry_date?: string;
}

// Move this custom hook outside the component
const useKeyboardNavigation = (
    gridRef: React.RefObject<HTMLDivElement>,
    filteredProducts: Product[],
    searchInputRef: React.RefObject<HTMLInputElement | null>
) => {
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if we're in an input field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }

            const grid = gridRef.current;
            if (!grid || filteredProducts.length === 0) return;

            // Get all focusable product elements
            const elements = Array.from(grid.querySelectorAll('[data-product-index]'));
            if (elements.length === 0) return;

            const cols = Math.floor(grid.clientWidth / 200) || 4; // Estimate columns based on container width
            const rows = Math.ceil(elements.length / cols);

            switch (e.key) {
                case 'ArrowRight':
                    e.preventDefault();
                    if (selectedIndex < 0) {
                        setSelectedIndex(0);
                        (elements[0] as HTMLElement).focus();
                    } else if (selectedIndex < elements.length - 1) {
                        setSelectedIndex(selectedIndex + 1);
                        (elements[selectedIndex + 1] as HTMLElement).focus();
                    }
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    if (selectedIndex < 0) {
                        setSelectedIndex(0);
                        (elements[0] as HTMLElement).focus();
                    } else if (selectedIndex > 0) {
                        setSelectedIndex(selectedIndex - 1);
                        (elements[selectedIndex - 1] as HTMLElement).focus();
                    }
                    break;

                case 'ArrowDown': {
                    e.preventDefault();
                    const currentRow = Math.floor(selectedIndex / cols);
                    const currentCol = selectedIndex % cols;

                    if (currentRow < rows - 1) {
                        const newIndex = (currentRow + 1) * cols + currentCol;
                        if (newIndex < elements.length) {
                            setSelectedIndex(newIndex);
                            (elements[newIndex] as HTMLElement).focus();
                        }
                    }
                    break;
                }

                case 'ArrowUp': {
                    e.preventDefault();
                    const currentRow = Math.floor(selectedIndex / cols);
                    const currentCol = selectedIndex % cols;

                    if (currentRow > 0) {
                        const newIndex = (currentRow - 1) * cols + currentCol;
                        setSelectedIndex(newIndex);
                        (elements[newIndex] as HTMLElement).focus();
                    } else {
                        // Focus back on search when at top row
                        searchInputRef.current?.focus();
                        setSelectedIndex(-1);
                    }
                    break;
                }

                case 'Escape':
                    searchInputRef.current?.focus();
                    setSelectedIndex(-1);
                    break;
            }
        };

        // Only attach event listener if there are products
        if (filteredProducts.length > 0) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [gridRef, filteredProducts, selectedIndex, searchInputRef]);

    return { selectedIndex, setSelectedIndex };
};

interface CartItem {
    id: string;
    name: string;
    qty: number;
    price: number;
    unit: string;
}

interface QuantityModalState {
    isOpen: boolean;
    productId: string | null;
    productName: string;
    availableStock: number;
    unit: string;
}

interface ApiResponse {
    success: boolean;
    error?: string;
    data?: any;
}

const POS: React.FC = () => {
    const [clientDate] = useState(() => new Date().toLocaleDateString());

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [showReceipt, setShowReceipt] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("");
    const [quantityModal, setQuantityModal] = useState<QuantityModalState>({
        isOpen: false,
        productId: null,
        productName: '',
        availableStock: 0,
        unit: ''
    });
    const [quantityInput, setQuantityInput] = useState<string>('');
    const [discountError, setDiscountError] = useState<string>('');
    const searchInputRef = useRef<HTMLInputElement>(null);
    const productContainerRef = useRef<HTMLDivElement>({} as HTMLDivElement);
    const quantityInputRef = useRef<HTMLInputElement>(null);
    const [orderId, setOrderId] = useState<string>("");

    // Define calculation functions first before they're used by other functions
    const calculateSubtotal = useCallback(() => {
        return items.reduce((total, item) => total + item.qty * item.price, 0).toFixed(2);
    }, [items]);

    const calculateTotal = useCallback(() => {
        const subtotal = parseFloat(calculateSubtotal());
        const finalDiscount = Math.min(discount, subtotal);
        return Math.max(0, (subtotal - finalDiscount)).toFixed(2);
    }, [calculateSubtotal, discount]);

    // Define modal handling functions before they're used
    const handleModalClose = useCallback(() => {
        setShowReceipt(false);
        // Clear cart only after closing the receipt
        setItems([]);
        setDiscount(0);
    }, []);

    const handlePrint = useCallback(() => {
        window.print();
        handleModalClose();
    }, [handleModalClose]);

    // Define basic utility functions
    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch('http://localhost:5000/api/products');

            if (!response.ok) {
                throw new Error('Failed to fetch products');
            }

            const data = await response.json();

            const processedData = data.map((product: any) => ({
                ...product,
                photo: product.photo ? processImageUrl(product.photo.toString()) : null,
                category: product.category_id?.name || product.category || 'Uncategorized'
            }));

            setProducts(processedData);
        } catch (err) {
            setError('Failed to load products');
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const processImageUrl = (photo: string | null): string => {
        if (!photo) return '';

        try {
            // If it's already a complete data URL, return as is
            if (photo.startsWith('data:image')) {
                return photo;
            }

            // If it's just a base64 string (without the data:image prefix)
            if (photo.match(/^[A-Za-z0-9+/=]+$/)) {
                return `data:image/jpeg;base64,${photo}`;
            }

            // If it's a URL path
            if (photo.startsWith('/')) {
                return `http://localhost:5000${photo}`;
            }

            // If it's a full URL
            if (photo.startsWith('http')) {
                return photo;
            }

            // If none of the above, assume it's a base64 string
            return `data:image/jpeg;base64,${photo}`;
        } catch (error) {
            console.error('Error processing image URL:', error);
            return '';
        }
    };

    const handleDiscount = useCallback((value: string) => {
        setDiscountError(''); // Clear previous error
        const subtotal = parseFloat(calculateSubtotal());
        const discountValue = parseFloat(value) || 0;

        if (discountValue < 0) {
            setDiscount(0);
            setDiscountError('Discount cannot be negative');
        } else if (discountValue > subtotal) {
            setDiscount(subtotal);
            setDiscountError('Discount cannot exceed total amount');
        } else {
            setDiscount(discountValue);
        }
    }, [calculateSubtotal]);

    // Handlers for item management
    const updateQty = useCallback(async (id: string, newQty: number) => {
        const product = products.find(p => p.id === id);
        const cartItem = items.find(item => item.id === id);
        if (!product || !cartItem) return;

        // Ensure quantity is not negative and doesn't exceed available stock
        const validatedQty = Math.max(1, Math.min(newQty, (product.stock + cartItem.qty)));

        // Calculate the difference in quantity
        const qtyDiff = validatedQty - cartItem.qty;
        if (qtyDiff === 0) return;

        try {
            // Update backend stock first
            const response = await fetch(`http://localhost:5000/api/products/${id}/stock`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    stock: product.stock - qtyDiff
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update stock in backend');
            }

            // If backend update successful, update frontend state
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === id ? { ...item, qty: validatedQty } : item
                )
            );

            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.id === id ? { ...p, stock: p.stock - qtyDiff } : p
                )
            );
        } catch (error) {
            console.error('Error updating quantity:', error);
            alert('Failed to update quantity. Please try again.');
        }
    }, [products, items]);

    const removeItem = useCallback(async (id: string) => {
        const item = items.find(i => i.id === id);
        if (item) {
            try {
                // Update stock in database
                const response = await fetch(`http://localhost:5000/api/products/${id}/stock`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        stock: (products.find(p => p.id === id)?.stock || 0) + item.qty // Reset original stock
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update stock in backend');
                }

                // Update local state
                setProducts(prevProducts =>
                    prevProducts.map(p =>
                        p.id === id
                            ? { ...p, stock: p.stock + item.qty }
                            : p
                    )
                );
                setItems(prevItems => prevItems.filter(i => i.id !== id));
            } catch (error) {
                console.error('Error removing item:', error);
            }
        }
    }, [products, items]);

    // Major functionality handlers
    const handlePayment = useCallback(async () => {
        if (items.length === 0) {
            setError("Cart is empty");
            return;
        }

        // Prepare sale data
        const saleData = {
            items: items.map(item => ({
                product_id: item.id,
                name: item.name,
                quantity: item.qty,
                price: item.price,
                unit: item.unit
            })),
            total: parseFloat(calculateTotal()),
            subtotal: parseFloat(calculateSubtotal()),
            discount: discount
        };

        try {
            setError(null);
            // Save sale to server
            const response = await fetch('http://localhost:5000/api/sales', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(saleData)
            });

            if (!response.ok) {
                throw new Error('Failed to save sale');
            }

            const result = await response.json();
            const saleId = result.id;

            setOrderId(saleId.toString()); // Store the exact database ID

            // Update products stock - NOW we actually update the database
            for (const item of items) {
                const productIndex = products.findIndex(p => p.id === item.id);
                if (productIndex !== -1) {
                    const updatedStock = Math.max(0, products[productIndex].stock);
                    
                    await fetch(`http://localhost:5000/api/products/${item.id}/stock`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            stock: updatedStock
                        })
                    });
                }
            }

            // Show the receipt with the correct order number
            setShowReceipt(true);

        } catch (err) {
            console.error(err);
            setError('Failed to process payment. Please try again.');
        }
    }, [items, calculateTotal, calculateSubtotal, discount, products]);

    const finalizeSale = useCallback(async () => {
        try {
            // Close the receipt and reset the cart
            handleModalClose();
            return true;
        } catch (error) {
            console.error('Error finalizing sale:', error);
            return false;
        }
    }, [handleModalClose]);

    const handleCancel = useCallback(async () => {
        if (items.length === 0) return;
        
        try {
          // Reset stock for each item in cart back to the original amounts
          for (const item of items) {
            const product = products.find(p => p.id === item.id);
            if (product) {
              // Reset stock in the UI immediately
              setProducts(prevProducts => 
                prevProducts.map(p => 
                  p.id === item.id 
                    ? { ...p, stock: p.stock + item.qty } 
                    : p
                )
              );
            }
          }
          
          // Clear the cart and reset discount
          setItems([]);
          setDiscount(0);
        } catch (error) {
          console.error('Error resetting stock:', error);
        }
      }, [items, products]);

    const addToCartById = useCallback((id: string) => {
        const product = products.find(p => p.id === id);

        if (!product) {
            console.error('Product not found');
            return;
        }

        if (product.stock <= 0) {
            alert("Sorry, this product is out of stock");
            return;
        }

        setQuantityModal({
            isOpen: true,
            productId: id,
            productName: product.name,
            availableStock: product.stock,
            unit: product.unit
        });
        setQuantityInput('1'); // Set a default value of 1 instead of empty string
    }, [products]);

    const handleQuantitySubmit = useCallback(() => {
        if (!quantityModal.productId) return;
        
        const product = products.find(p => p.id === quantityModal.productId);
        if (!product) return;
        
        const quantity = parseInt(quantityInput);
        if (isNaN(quantity) || quantity <= 0 || quantity > quantityModal.availableStock) {
          setQuantityInput('');
          return;
        }
        
        const existingItem = items.find(item => item.id === quantityModal.productId);
        
        if (existingItem) {
          updateQty(quantityModal.productId, existingItem.qty + quantity);
        } else {
          // Add item to cart
          setItems(prevItems => [
            ...prevItems,
            {
              id: product.id,
              name: product.name,
              qty: quantity,
              price: product.price,
              unit: product.unit
            }
          ]);
          
          // Update product stock in state
          // BUT don't actually reduce the stock in the database until checkout
          // This is just visual feedback for the user
          setProducts(prevProducts => 
            prevProducts.map(p => 
              p.id === quantityModal.productId 
                ? { ...p, stock: p.stock - quantity } 
                : p
            )
          );
        }
        
        // Clear search input and maintain focus
        setSearch('');
        setQuantityModal(prev => ({ ...prev, isOpen: false }));
        searchInputRef.current?.focus();
      }, [quantityModal, quantityInput, products, items, updateQty]);

    // Filtered products
    const filteredProducts = products.filter((product) => {
        const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
        if (!filter) return matchesSearch;

        switch (filter) {
            case "Category":
                return matchesSearch && product.category.toLowerCase().includes(search.toLowerCase());
            case "Stock":
                return matchesSearch && product.stock > 0;
            default:
                return matchesSearch;
        }
    });

    // Use the custom hook properly, passing the searchInputRef
    const { selectedIndex, setSelectedIndex } = useKeyboardNavigation(
        productContainerRef,
        filteredProducts,
        searchInputRef
    );

    // Effect hooks
    useEffect(() => {
        fetchProducts();

        const eventSource = new EventSource('http://localhost:5000/api/products/updates');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'product_update' && data.product) {
                    setProducts(prevProducts => {
                        // Check if product already exists
                        const exists = prevProducts.some(p => p.id === data.product.id);

                        if (exists) {
                            // Update existing product
                            return prevProducts.map(p =>
                                p.id === data.product.id
                                    ? {
                                        ...p,
                                        ...data.product,
                                        photo: data.product.photo ? processImageUrl(data.product.photo.toString()) : p.photo,
                                        category: data.product.category || p.category || 'Uncategorized'
                                    }
                                    : p
                            );
                        } else {
                            // Add new product
                            return [...prevProducts, {
                                ...data.product,
                                photo: data.product.photo ? processImageUrl(data.product.photo.toString()) : null,
                                category: data.product.category || 'Uncategorized'
                            }];
                        }
                    });
                } else if (data.type === 'product_deleted' && data.id) {
                    setProducts(prevProducts =>
                        prevProducts.filter(p => p.id !== data.id)
                    );
                    // Also remove from cart if present
                    setItems(prevItems =>
                        prevItems.filter(item => item.id !== data.id)
                    );
                }
            } catch (error) {
                console.error('Error processing SSE update:', error);
            }
        };

        eventSource.onerror = () => {
            console.log('SSE connection failed, retrying...');
            eventSource.close();
            setTimeout(fetchProducts, 5000);
        };

        return () => eventSource.close();
    }, []);

    useEffect(() => {
        // Focus the search input when component mounts
        searchInputRef.current?.focus();
    }, []);

    // Update the useEffect hook for keyboard handling
    useEffect(() => {
        const searchInput = searchInputRef.current;
        if (!searchInput) return;

        // Focus search input on mount
        searchInput.focus();

        const handleKeyPress = (e: KeyboardEvent) => {
            // Get the active element
            const activeElement = document.activeElement;

            // If the active element is an input/textarea other than search, don't interfere
            if (
                activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement
            ) {
                if (activeElement !== searchInput) {
                    return;
                }
            }

            // Skip for special key combinations
            if (e.ctrlKey || e.altKey || e.metaKey) {
                return;
            }

            // Only handle printable characters
            if (e.key.length === 1) {
                searchInput.focus();
            }
        };

        // Add event listener
        window.addEventListener('keydown', handleKeyPress);

        // Cleanup
        return () => {
            window.removeEventListener('keydown', handleKeyPress);
        };
    }, []);

    // Split keyboard handlers into two effects to avoid circular dependencies
    useEffect(() => {
        const handleBasicKeyboard = (e: KeyboardEvent) => {
            // Always handle F8 and Escape regardless of focus
            if (e.key === 'F8' || e.key === 'Escape') {
                e.preventDefault();

                switch (e.key) {
                    case 'F8':
                        // Focus discount input
                        const discountInput = document.querySelector('input[placeholder="Amount (F8)"]') as HTMLInputElement;
                        discountInput?.focus();
                        break;

                    case 'Escape':
                        // Handle modal closing
                        if (quantityModal.isOpen) {
                            setQuantityModal(prev => ({ ...prev, isOpen: false }));
                            searchInputRef.current?.focus();
                        } else if (showReceipt) {
                            handleModalClose();
                        } else {
                            // If no modals are open, focus search
                            searchInputRef.current?.focus();
                            setSearch('');
                            setSelectedIndex(-1);
                        }
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleBasicKeyboard);
        return () => window.removeEventListener('keydown', handleBasicKeyboard);
    }, [quantityModal.isOpen, showReceipt, handleModalClose, setSelectedIndex]);

    // Separate effect for handlers that depend on other functions
    useEffect(() => {
        const handleActionKeyboard = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            const isInputField = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

            // Action shortcuts
            if (e.key === 'Delete' ) {
                e.preventDefault();
                if (items.length > 0) {
                    handleCancel();
                }
            } else if (e.key === 'Shift') {
                // Remove the isInputField condition for Shift key
                e.preventDefault();
                if (items.length > 0) {
                    handlePayment();
                }
            } else if (e.key === 'F2') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }

            // Modify item quantity shortcuts
            if (!isInputField) {
                switch (e.key) {
                    case '+':
                        e.preventDefault();
                        if (items.length > 0) {
                            const lastItem = items[items.length - 1];
                            const product = products.find(p => p.id === lastItem.id);
                            if (product && lastItem.qty < product.stock + lastItem.qty) {
                                updateQty(lastItem.id, lastItem.qty + 1);
                            }
                        }
                        break;
                    case '-':
                        e.preventDefault();
                        if (items.length > 0) {
                            const lastItem = items[items.length - 1];
                            if (lastItem.qty > 1) {
                                updateQty(lastItem.id, lastItem.qty - 1);
                            }
                        }
                        break;
                }
            }
        };

        window.addEventListener('keydown', handleActionKeyboard);
        return () => window.removeEventListener('keydown', handleActionKeyboard);
    }, [items, products, handleCancel, handlePayment, updateQty]);

    useEffect(() => {
        if (quantityModal.isOpen) {
            // Use a small timeout to ensure the modal is rendered
            const timeoutId = setTimeout(() => {
                quantityInputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [quantityModal.isOpen]);

    return (
        <div className="flex items-center justify-center fixed w-full">
            <div className="grid grid-cols-2 gap-8 w-full px-8 h-[570px] p-2">
                {/* Left Section */}
                <div className="bg-gray-200 p-4 rounded-2xl shadow-2xl shadow-neutral-500 h-[550px] px-8">
                    {/* Left section content */}
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-teal-800">Current Items</h2>
                        <span className="text-gray-600">{clientDate}</span>
                    </div>

                    {/* Items Table */}
                    <div className="rounded-xl mt-4 h-[350px]">
                        {/* Table content */}
                        <div className="h-[310px] overflow-y-auto">
                            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                                <table className="w-full border-collapse table-fixed">
                                    <colgroup>
                                        <col className="w-[8%]" />{/* # column */}
                                        <col className="w-[32%]" />{/* Product name column */}
                                        <col className="w-[30%]" />{/* Quantity column */}
                                        <col className="w-[20%]" />{/* Price column */}
                                        <col className="w-[10%]" />{/* Actions column */}
                                    </colgroup>
                                    <thead className="bg-teal-500 text-white sticky top-0 z-10">
                                        <tr>
                                            <th className="p-3 text-center">#</th>
                                            <th className="p-3 text-left">Item</th>
                                            <th className="p-3 text-center">Qty</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-4 text-center text-gray-500 border-b">
                                                    Cart is empty. Add products to begin.
                                                </td>
                                            </tr>
                                        ) : (
                                            items.map((item, index) => {
                                                const product = products.find(p => p.id === item.id);
                                                return (
                                                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                                                        <td className="p-3 text-center text-gray-700">{index + 1}</td>
                                                        <td className="p-3 font-medium text-black overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</td>
                                                        <td className="p-3">
                                                            <div className="flex items-center justify-center space-x-1">
                                                                <button
                                                                    className={`${item.qty > 1 ? 'text-red-500 hover:text-red-700' : 'text-gray-300'} 
                                                                    focus:outline-none rounded-full p-1 hover:bg-gray-100`}
                                                                    disabled={item.qty <= 1}
                                                                    onClick={() => {
                                                                        if (item.qty > 1) {
                                                                            updateQty(item.id, item.qty - 1);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter    ' && item.qty > 1) {
                                                                            updateQty(item.id, item.qty - 1);
                                                                        }
                                                                    }}
                                                                    tabIndex={0}
                                                                    aria-label={`Decrease quantity of ${item.name}`}
                                                                >
                                                                    <FaMinusCircle size={18} />
                                                                </button>

                                                                <input
                                                                    type="number"
                                                                    value={item.qty}
                                                                    className="w-14 p-1 text-center border rounded-md [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-gray-800"
                                                                    min="1"
                                                                    max={(product?.stock ?? 0) + item.qty}
                                                                    onChange={(e) => {
                                                                        const value = e.target.value;
                                                                        if (value === '') {
                                                                            return;
                                                                        }
                                                                        if (/^[1-9]\d*$/.test(value)) {
                                                                            const newQty = parseInt(value);
                                                                            updateQty(item.id, newQty);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            e.currentTarget.blur();
                                                                        }
                                                                    }}
                                                                    aria-label={`Quantity of ${item.name}`}
                                                                />

                                                                <button
                                                                    className={`${item.qty < ((product?.stock ?? 0) + item.qty) ?
                                                                        'text-green-600 hover:text-green-700' : 'text-gray-300'} 
                                                                    focus:outline-none rounded-full p-1 hover:bg-gray-100`}
                                                                    disabled={item.qty >= ((product?.stock ?? 0) + item.qty)}
                                                                    onClick={() => {
                                                                        if (item.qty < ((product?.stock ?? 0) + item.qty)) {
                                                                            updateQty(item.id, item.qty + 1);
                                                                        }
                                                                    }}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' && item.qty < ((product?.stock ?? 0) + item.qty)) {
                                                                            updateQty(item.id, item.qty + 1);
                                                                        }
                                                                    }}
                                                                    tabIndex={0}
                                                                    aria-label={`Increase quantity of ${item.name}`}
                                                                >
                                                                    <FaPlusCircle size={18} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right font-medium text-black">Rs. {(item.qty * item.price).toFixed(2)}</td>
                                                        <td className="p-3 text-center">
                                                            <button
                                                                className="p-2 text-white bg-red-500 hover:bg-red-700 rounded-full focus:outline-none"
                                                                onClick={() => removeItem(item.id)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        removeItem(item.id);
                                                                    }
                                                                }}
                                                                tabIndex={0}
                                                                title="Remove item"
                                                                aria-label={`Remove ${item.name} from cart`}
                                                            >
                                                                <span className="sr-only">Remove</span>
                                                                <FaTimes size={12} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    {/* Summary Section */}
                    <div className="pt-2 flex text-gray-800 justify-between pr-8">
                        {/* Summary content */}
                        <div className="space-y-2" >
                            <p>Total Item(s): <span className="font-bold text-2xl">{items.reduce((total, item) => total + item.qty, 0)}</span></p>
                            <div className="space-y-1 flex space-x-4 items-end">
                                <p>Discount:</p>
                                <div className="flex-row ">
                                    <input
                                        type="text"
                                        className={`p-1 rounded-full px-2 w-30 text-black text-center hover:bg-teal-200 border-2 bg-gray-300
                                            ${discountError ? 'border-red-500' : 'border-gray-300'}`}
                                        placeholder="Amount (F8)"
                                        title="Press F8 to focus"
                                        value={discount || ''}
                                        onChange={(e) => handleDiscount(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === '-') e.preventDefault();
                                        }}

                                    />
                                    <button
                                        onClick={() => handleDiscount('0')}
                                        disabled={items.length === 0}
                                        className={` text-white ml-2 bg-red-500 px-2 rounded-full ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                                            }`}
                                        onKeyDown={(e) => {
                                            if (e.key === '' && items.length > 0) {
                                                handleDiscount('0');
                                            }
                                        }}
                                        tabIndex={0}
                                        aria-label="Clear discount"
                                    >
                                        x
                                    </button>
                                    {discountError && (
                                        <div className="text-red-500 text-sm">
                                            {discountError}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div>
                            <p>Price: <span className="font-bold">{calculateSubtotal()}</span></p>
                            <p>Total: <span className="text-red-500 text-3xl font-bold">{calculateTotal()}</span></p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 justify-end ">
                        {/* Buttons */}
                        <button
                            onClick={handleCancel}
                            disabled={items.length === 0}
                            className={`bg-red-500 text-white px-4 py-2 rounded-lg ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'
                                }`}
                            onKeyDown={(e) => {
                                if (e.key === 'Delete' && items.length > 0) {
                                    handleCancel();
                                }
                            }}
                            tabIndex={0}
                            aria-label="Cancel order"
                        >
                            Cancel
                        </button>



                        <button
                            onClick={handlePayment}
                            disabled={items.length === 0}
                            className={`bg-green-500 text-white px-8 py-2 rounded-lg ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'
                                }`}
                            onKeyDown={(e) => {
                                if (e.key === 'Shift' && items.length > 0) {
                                    handlePayment();
                                }
                            }}
                            tabIndex={0}
                            aria-label="Process payment"
                        >
                            Pay
                        </button>
                    </div>
                </div>

                {/* Right Section */}
                <div className="bg-gray-200 p-4 rounded-2xl shadow-2xl shadow-neutral-500 px-8 h-[550px]">
                    {/* Right section content */}
                    {/* Search & Filter */}

                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search items by Name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="p-2 pl-4 mt-4 w-full rounded-3xl text-black bg-white text-center shadow-xl hover:bg-teal-100"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredProducts.length > 0) {
                                e.preventDefault();
                                // Focus the first product in the filtered list
                                const firstProduct = productContainerRef.current?.querySelector('[data-product-index="0"]') as HTMLElement;
                                if (firstProduct) {
                                    firstProduct.focus();
                                    setSelectedIndex(0);
                                }
                            } else if (e.key === 'ArrowDown' && filteredProducts.length > 0) {
                                e.preventDefault();
                                // Focus the first product in the filtered list
                                const firstProduct = productContainerRef.current?.querySelector('[data-product-index="0"]') as HTMLElement;
                                if (firstProduct) {
                                    firstProduct.focus();
                                    setSelectedIndex(0);
                                }
                            }
                        }}
                        aria-label="Search products"
                    />

                    {/* Product List */}
                    <div className="rounded-2xl mt-4 h-[440px] overflow-y-auto p-4 text-gray-500 text-center">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <p className="text-red-500 mb-4">{error}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="bg-teal-500 text-white px-4 py-2 rounded hover:bg-teal-600"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : filteredProducts.length > 0 ? (
                            <div
                                ref={productContainerRef}
                                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
                                role="grid"
                            >
                                {filteredProducts.map((product, index) => (
                                    <div
                                        key={product.id}
                                        data-product-index={index}
                                        onClick={() => product.stock > 0 ? addToCartById(product.id) : null}
                                        onKeyDown={(e) => {
                                            switch (e.key) {
                                                case 'Enter':
                                                case ' ':
                                                    e.preventDefault();
                                                    if (product.stock > 0) addToCartById(product.id);
                                                    break;
                                                case 'ArrowRight':
                                                case 'ArrowLeft':
                                                case 'ArrowUp':
                                                case 'ArrowDown':
                                                    // These will be handled by the grid navigation
                                                    break;
                                                case 'Escape':
                                                    searchInputRef.current?.focus();
                                                    setSelectedIndex(-1);
                                                    break;
                                            }
                                        }}
                                        tabIndex={0}
                                        aria-selected={selectedIndex === index}
                                        className={`rounded-xl  overflow-hidden shadow-md transition-transform transform hover:scale-102  focus:outline-none focus:ring-2 focus:ring-teal-500  ${selectedIndex === index ? 'ring-2 ring-teal-500' : ''
                                            } ${product.stock <= 0 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'
                                            }`}
                                    >
                                        <div className="relative h-24   bg-white ">
                                            {product.photo ? (
                                                <img
                                                    src={product.photo}
                                                    alt={product.name}
                                                    className="w-full h-full object-fill p-2 rounded-2xl "
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                    <FaImage className="text-black" size={40} />
                                                </div>
                                            )}
                                            {product.stock <= 0 && (
                                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                                    <span className="bg-red-500 text-white px-2 py-1 rounded font-bold transform rotate-10 text-sm">
                                                        Out of Stock
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2 bg-white ">
                                            <h3 className="font-bold text-gray-800 truncate">{product.name}</h3>
                                            <p className="text-teal-600 font-medium">Rs. {product.price.toFixed(2)}</p>
                                            <div className="mt-1 flex justify-items-center">
                                                <p className="text-xs text-gray-600 ">
                                                    {product.stock > 0 ? (
                                                        <>
                                                            <span className="font-medium ml-4 ">Stock:</span> {product.stock} {product.unit}
                                                        </>
                                                    ) : (
                                                        <span className="text-red-500">Out of Stock</span>
                                                    )}
                                                </p>
                                                
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-red-500">No matching products found.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showReceipt && (
                <ReceiptModal
                    items={items}
                    discount={discount}
                    calculateSubtotal={calculateSubtotal}
                    calculateTotal={calculateTotal}
                    handlePrint={handlePrint}
                    onClose={handleModalClose}
                    saveSale={finalizeSale}
                    orderNumber={orderId} // Pass the order ID directly, no formatting
                />
            )}

            {/* Quantity Modal */}
            {quantityModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-96">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Add to Cart</h2>
                        <p className="text-lg mb-1 text-gray-700">{quantityModal.productName}</p>
                        <p className="text-sm mb-4 text-gray-600">Available: {quantityModal.availableStock} {quantityModal.unit}</p>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Enter Quantity:
                            </label>
                            <input
                                ref={quantityInputRef}
                                type="number"
                                className="w-full p-2 border border-gray-300 rounded text-black apperance-none"
                                value={quantityInput}
                                onChange={(e) => setQuantityInput(e.target.value)}
                                min="1"
                                max={quantityModal.availableStock}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleQuantitySubmit();
                                    } else if (e.key === 'Escape') {
                                        setQuantityModal(prev => ({ ...prev, isOpen: false }));
                                        searchInputRef.current?.focus();
                                    }
                                }}
                                autoFocus
                            />
                        </div>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => {
                                    setQuantityModal(prev => ({ ...prev, isOpen: false }));
                                    searchInputRef.current?.focus();
                                }}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                tabIndex={0}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleQuantitySubmit}
                                className="px-4 py-2 bg-teal-500 text-white rounded hover:bg-teal-600"
                                tabIndex={0}
                            >
                                Add to Cart
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <KeyboardShortcuts />
        </div>
    );
};

export default POS;

