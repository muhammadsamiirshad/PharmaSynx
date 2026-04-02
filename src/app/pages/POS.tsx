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
    generic_name?: string;
    description: string;
    category: string;
    price: number;
    stock: number;
    strips_per_box?: number;
    tabs_per_strip?: number;
    price_per_box?: number;
    price_per_strip?: number;
    price_per_tablet?: number;
    base_stock?: number;
    unit: string;
    unit_config?: {
        unit_levels?: number;
        level_1_name?: string | null;
        level_2_name?: string | null;
        level_3_name?: string | null;
        conversion_1_to_2?: number | null;
        conversion_2_to_3?: number | null;
    };
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
    lineTotal: number;
    unit: string;
    product?: Product;
    formattedQty?: string;
}

interface QuantityModalState {
    isOpen: boolean;
    productId: string | null;
    productName: string;
    availableBaseStock: number;
    baseUnitName: string;
}

interface ApiResponse {
    success: boolean;
    error?: string;
    data?: any;
}

interface HeldBill {
    items: CartItem[];
    discount: number;
    createdAt: string;
}

const POS: React.FC = () => {
    const [clientDate] = useState(() => new Date().toLocaleDateString());

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [items, setItems] = useState<CartItem[]>([]);
    const [discount, setDiscount] = useState(0);
    const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
    const [showReceipt, setShowReceipt] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState("");
    const [quantityModal, setQuantityModal] = useState<QuantityModalState>({
        isOpen: false,
        productId: null,
        productName: '',
        availableBaseStock: 0,
        baseUnitName: ''
    });
    const [level1Qty, setLevel1Qty] = useState<number>(0);
    const [level2Qty, setLevel2Qty] = useState<number>(0);
    const [level3Qty, setLevel3Qty] = useState<number>(0);
    const [discountError, setDiscountError] = useState<string>('');
    const [heldBills, setHeldBills] = useState<HeldBill[]>([]);
    const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const discountInputRef = useRef<HTMLInputElement>(null);
    const productContainerRef = useRef<HTMLDivElement>({} as HTMLDivElement);
    const [orderId, setOrderId] = useState<string>("");

    const getBaseStock = useCallback((product: Product) => {
        return product.base_stock ?? product.stock ?? 0;
    }, []);

    const getUnitConfig = useCallback((product: Product) => {
        const unitLevels = Math.min(3, Math.max(1, Number(product.unit_config?.unit_levels ?? 1)));
        const level1Name = (product.unit_config?.level_1_name || 'Unit').trim();
        const level2Name = (product.unit_config?.level_2_name || 'Sub Unit').trim();
        const level3Name = (product.unit_config?.level_3_name || product.unit || 'Unit').trim();
        const conversion1To2 = Math.max(1, Number(product.unit_config?.conversion_1_to_2 ?? product.strips_per_box ?? 1));
        const conversion2To3 = Math.max(1, Number(product.unit_config?.conversion_2_to_3 ?? product.tabs_per_strip ?? 1));

        return {
            unitLevels,
            level1Name,
            level2Name,
            level3Name,
            conversion1To2,
            conversion2To3
        };
    }, []);

    const getUnitPrices = useCallback((product: Product) => {
        const config = getUnitConfig(product);
        const level1Price = product.price_per_box ?? product.price;
        const level2Price = config.unitLevels >= 2
            ? (product.price_per_strip ?? (level1Price / config.conversion1To2))
            : 0;
        const level3Price = config.unitLevels === 3
            ? (product.price_per_tablet ?? (level2Price / config.conversion2To3))
            : (config.unitLevels === 2 ? 1 : level1Price);

        return { level1Price, level2Price, level3Price };
    }, [getUnitConfig]);

    const calculateSelectedBaseQty = useCallback((product: Product, l1: number, l2: number, l3: number) => {
        const config = getUnitConfig(product);
        if (config.unitLevels === 1) {
            return l1;
        }
        if (config.unitLevels === 2) {
            return (l1 * config.conversion1To2) + l2;
        }
        return (l1 * config.conversion1To2 * config.conversion2To3) + (l2 * config.conversion2To3) + l3;
    }, [getUnitConfig]);

    const calculateSelectedLineTotal = useCallback((product: Product, l1: number, l2: number, l3: number) => {
        const config = getUnitConfig(product);
        const prices = getUnitPrices(product);

        if (config.unitLevels === 1) {
            return l1 * prices.level1Price;
        }
        if (config.unitLevels === 2) {
            return (l1 * prices.level1Price) + (l2 * prices.level2Price);
        }
        return (l1 * prices.level1Price) + (l2 * prices.level2Price) + (l3 * prices.level3Price);
    }, [getUnitConfig, getUnitPrices]);

    const formatStock = useCallback((product: Product) => {
        const base = getBaseStock(product);
        const config = getUnitConfig(product);

        if (config.unitLevels === 1) {
            return `${base} ${config.level1Name}`;
        }

        if (config.unitLevels === 2) {
            const level1Count = Math.floor(base / config.conversion1To2);
            const level2Count = base % config.conversion1To2;
            const parts: string[] = [];
            if (level1Count > 0) parts.push(`${level1Count} ${config.level1Name}`);
            if (level2Count > 0) parts.push(`${level2Count} ${config.level2Name}`);
            return parts.length ? parts.join(', ') : `0 ${config.level2Name}`;
        }

        const level1Factor = config.conversion1To2 * config.conversion2To3;
        const level1Count = Math.floor(base / level1Factor);
        const remAfterL1 = base % level1Factor;
        const level2Count = Math.floor(remAfterL1 / config.conversion2To3);
        const level3Count = remAfterL1 % config.conversion2To3;
        const parts: string[] = [];
        if (level1Count > 0) parts.push(`${level1Count} ${config.level1Name}`);
        if (level2Count > 0) parts.push(`${level2Count} ${config.level2Name}`);
        if (level3Count > 0) parts.push(`${level3Count} ${config.level3Name}`);
        return parts.length ? parts.join(', ') : `0 ${config.level3Name}`;
    }, [getBaseStock, getUnitConfig]);

    const formatCartQuantity = useCallback((product: Product | undefined, baseQty: number) => {
        if (!product) return `${baseQty} Unit`;
        return formatStock({ ...product, base_stock: baseQty, stock: baseQty });
    }, [formatStock]);

    // Define calculation functions first before they're used by other functions
    const calculateSubtotal = useCallback(() => {
        return items.reduce((total, item) => total + item.lineTotal, 0).toFixed(2);
    }, [items]);

    const calculateDiscountAmount = useCallback(() => {
        const subtotal = parseFloat(calculateSubtotal());

        if (discountType === 'percentage') {
            const percentage = Math.min(Math.max(discount, 0), 100);
            return (subtotal * percentage) / 100;
        }

        return Math.min(Math.max(discount, 0), subtotal);
    }, [calculateSubtotal, discount, discountType]);

    const calculateTotal = useCallback(() => {
        const subtotal = parseFloat(calculateSubtotal());
        const finalDiscount = calculateDiscountAmount();
        return Math.max(0, (subtotal - finalDiscount)).toFixed(2);
    }, [calculateSubtotal, calculateDiscountAmount]);

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
        } else if (discountType === 'percentage' && discountValue > 100) {
            setDiscount(100);
            setDiscountError('Percentage discount cannot exceed 100%');
        } else if (discountType === 'flat' && discountValue > subtotal) {
            setDiscount(subtotal);
            setDiscountError('Discount cannot exceed total amount');
        } else {
            setDiscount(discountValue);
        }
    }, [calculateSubtotal, discountType]);

    // Handlers for item management
    const updateQty = useCallback(async (id: string, newQty: number) => {
        const product = products.find(p => p.id === id);
        const cartItem = items.find(item => item.id === id);
        if (!product || !cartItem) return;

        const currentBaseStock = getBaseStock(product);

        // Ensure quantity is not negative and doesn't exceed available stock
        const validatedQty = Math.max(1, Math.min(newQty, (currentBaseStock + cartItem.qty)));

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
                    base_stock: currentBaseStock - qtyDiff
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update stock in backend');
            }

            // If backend update successful, update frontend state
            setItems(prevItems =>
                prevItems.map(item =>
                    item.id === id
                        ? {
                            ...item,
                            qty: validatedQty,
                            lineTotal: validatedQty * (item.qty > 0 ? item.lineTotal / item.qty : product.price_per_tablet || 0),
                            product: item.product || product
                        }
                        : item
                )
            );

            setProducts(prevProducts =>
                prevProducts.map(p =>
                    p.id === id
                        ? {
                            ...p,
                            base_stock: Math.max(0, (p.base_stock ?? p.stock ?? 0) - qtyDiff),
                            stock: Math.max(0, (p.base_stock ?? p.stock ?? 0) - qtyDiff)
                        }
                        : p
                )
            );
        } catch (error) {
            console.error('Error updating quantity:', error);
            alert('Failed to update quantity. Please try again.');
        }
    }, [products, items, getBaseStock]);

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
                        base_stock: (products.find(p => p.id === id)?.base_stock ?? products.find(p => p.id === id)?.stock ?? 0) + item.qty
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to update stock in backend');
                }

                // Update local state
                setProducts(prevProducts =>
                    prevProducts.map(p =>
                        p.id === id
                            ? {
                                ...p,
                                base_stock: (p.base_stock ?? p.stock ?? 0) + item.qty,
                                stock: (p.base_stock ?? p.stock ?? 0) + item.qty
                            }
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
        const discountAmount = parseFloat(calculateDiscountAmount().toFixed(2));
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
            discount: discountAmount
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
                    const updatedBaseStock = Math.max(0, products[productIndex].base_stock ?? products[productIndex].stock ?? 0);
                    
                    await fetch(`http://localhost:5000/api/products/${item.id}/stock`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            base_stock: updatedBaseStock
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
    }, [items, calculateTotal, calculateSubtotal, calculateDiscountAmount, products]);

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
                                        ? {
                                                ...p,
                                                base_stock: (p.base_stock ?? p.stock ?? 0) + item.qty,
                                                stock: (p.base_stock ?? p.stock ?? 0) + item.qty
                                        }
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

    const holdCurrentBill = useCallback(() => {
        if (items.length === 0) return;

        setHeldBills(prev => [
            ...prev,
            {
                items: [...items],
                discount,
                createdAt: new Date().toISOString()
            }
        ]);

        setItems([]);
        setDiscount(0);
        setSearch('');
        setShowReceipt(false);
        setOrderId('');
    }, [items, discount]);

    const resumeBill = useCallback((index: number) => {
        const bill = heldBills[index];
        if (!bill) return;

        if (items.length > 0) {
            const shouldReplace = window.confirm("Current cart has items. Are you sure you want to replace it with this held bill?");
            if (!shouldReplace) {
                return;
            }
        }

        setItems(bill.items);
        setDiscount(bill.discount);
        setHeldBills(prev => prev.filter((_, i) => i !== index));
        setShowHeldBillsModal(false);
    }, [heldBills, items.length]);

    const addToCartById = useCallback((id: string) => {
        const product = products.find(p => p.id === id);

        if (!product) {
            console.error('Product not found');
            return;
        }

        const availableBaseStock = getBaseStock(product);

        if (availableBaseStock <= 0) {
            alert("Sorry, this product is out of stock");
            return;
        }

        setQuantityModal({
            isOpen: true,
            productId: id,
            productName: product.name,
            availableBaseStock,
            baseUnitName: getUnitConfig(product).level3Name
        });
        setLevel1Qty(0);
        setLevel2Qty(0);
        setLevel3Qty(0);
    }, [products, getBaseStock, getUnitConfig]);

    const handleQuantitySubmit = useCallback(() => {
        if (!quantityModal.productId) return;
        
        const product = products.find(p => p.id === quantityModal.productId);
        if (!product) return;

            const totalBaseQuantity = calculateSelectedBaseQty(product, level1Qty, level2Qty, level3Qty);
            const lineTotal = calculateSelectedLineTotal(product, level1Qty, level2Qty, level3Qty);

                if (totalBaseQuantity <= 0 || totalBaseQuantity > quantityModal.availableBaseStock) {
                    return;
                }
        
        const existingItem = items.find(item => item.id === quantityModal.productId);
        
        if (existingItem) {
                    setItems(prevItems =>
                        prevItems.map(item =>
                            item.id === quantityModal.productId
                                ? {
                                        ...item,
                                        qty: item.qty + totalBaseQuantity,
                                        lineTotal: item.lineTotal + lineTotal,
                                        product: item.product || product
                                    }
                                : item
                        )
                    );
        } else {
          // Add item to cart
          setItems(prevItems => [
            ...prevItems,
            {
              id: product.id,
              name: product.name,
                            qty: totalBaseQuantity,
                                                        price: product.price,
                            lineTotal,
                            unit: product.unit,
                            product
            }
          ]);
        }

                // Update product stock in state (frontend only until checkout)
                setProducts(prevProducts =>
                    prevProducts.map(p =>
                        p.id === quantityModal.productId
                            ? {
                                    ...p,
                                    base_stock: Math.max(0, (p.base_stock ?? p.stock ?? 0) - totalBaseQuantity),
                                    stock: Math.max(0, (p.base_stock ?? p.stock ?? 0) - totalBaseQuantity)
                                }
                            : p
                    )
                );
        
        // Clear search input and maintain focus
        setSearch('');
        setQuantityModal(prev => ({ ...prev, isOpen: false }));
        searchInputRef.current?.focus();
            }, [quantityModal, products, items, level1Qty, level2Qty, level3Qty, calculateSelectedBaseQty, calculateSelectedLineTotal]);

    // Filtered products
    const filteredProducts = products.filter((product) => {
        const query = search.toLowerCase();
        const matchesSearch =
            product.name.toLowerCase().includes(query) ||
            (product.generic_name || '').toLowerCase().includes(query);
        if (!filter) return matchesSearch;

        switch (filter) {
            case "Category":
                return matchesSearch && product.category.toLowerCase().includes(query);
            case "Stock":
                return matchesSearch && getBaseStock(product) > 0;
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
                            if (product && lastItem.qty < getBaseStock(product) + lastItem.qty) {
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
        const handleAltShortcuts = (e: KeyboardEvent) => {
            if (!e.altKey) return;

            const key = e.key.toLowerCase();
            if (!['d', 'p', 's'].includes(key)) return;

            e.preventDefault();

            if (key === 's') {
                searchInputRef.current?.focus();
                return;
            }

            if (key === 'd') {
                discountInputRef.current?.focus();
                return;
            }

            if (key === 'p') {
                if (showReceipt) {
                    handlePrint();
                } else if (items.length > 0) {
                    handlePayment();
                }
            }
        };

        window.addEventListener('keydown', handleAltShortcuts);
        return () => window.removeEventListener('keydown', handleAltShortcuts);
    }, [items.length, showReceipt, handlePayment, handlePrint]);

    return (
        <div className="w-full max-w-full px-2 overflow-hidden h-full">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 w-full max-w-full items-stretch flex-1 h-[calc(100vh-80px)] min-h-0">
                {/* Left Section */}
                <div className="flex flex-col h-full min-h-0 bg-white rounded-xl shadow-md p-3 overflow-hidden">
                    <div className="shrink-0 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-teal-800">Current Items</h2>
                        <span className="text-xs text-gray-600">{clientDate}</span>
                    </div>

                    {/* Items Table */}
                    <div className="flex-1 overflow-y-auto mt-3 rounded-lg border border-gray-100 bg-white">
                        <table className="w-full border-collapse table-fixed text-xs">
                            <colgroup>
                                <col className="w-[8%]" />{/* # column */}
                                <col className="w-[32%]" />{/* Product name column */}
                                <col className="w-[30%]" />{/* Quantity column */}
                                <col className="w-[20%]" />{/* Price column */}
                                <col className="w-[10%]" />{/* Actions column */}
                            </colgroup>
                            <thead className="bg-teal-500 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="py-2 px-2 text-center">#</th>
                                    <th className="py-2 px-2 text-left">Item</th>
                                    <th className="py-2 px-2 text-center">Qty</th>
                                    <th className="py-2 px-2 text-right">Total</th>
                                    <th className="py-2 px-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-2 px-2 text-center text-gray-500 border-b text-xs">
                                            Cart is empty. Add products to begin.
                                        </td>
                                    </tr>
                                ) : (
                                    items.map((item, index) => {
                                        const product = products.find(p => p.id === item.id);
                                        return (
                                            <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                                                <td className="py-1 px-2 text-center text-gray-700">{index + 1}</td>
                                                <td className="py-1 px-2 font-medium text-black overflow-hidden text-ellipsis whitespace-nowrap">{item.name}</td>
                                                <td className="py-1 px-2">
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

                                                        <span className="px-2 py-1 text-[11px] font-medium text-gray-800 bg-gray-100 rounded-md min-w-[96px] text-center">
                                                            {formatCartQuantity(item.product || product, item.qty)}
                                                        </span>

                                                        <button
                                                            className={`${item.qty < ((product ? getBaseStock(product) : 0) + item.qty) ?
                                                                'text-green-600 hover:text-green-700' : 'text-gray-300'} 
                                                            focus:outline-none rounded-full p-1 hover:bg-gray-100`}
                                                            disabled={item.qty >= ((product ? getBaseStock(product) : 0) + item.qty)}
                                                            onClick={() => {
                                                                if (item.qty < ((product ? getBaseStock(product) : 0) + item.qty)) {
                                                                    updateQty(item.id, item.qty + 1);
                                                                }
                                                            }}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && item.qty < ((product ? getBaseStock(product) : 0) + item.qty)) {
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
                                                <td className="py-1 px-2 text-right font-medium text-black">Rs. {item.lineTotal.toFixed(2)}</td>
                                                <td className="py-1 px-2 text-center">
                                                    <button
                                                        className="p-1.5 text-white bg-red-500 hover:bg-red-700 rounded-full focus:outline-none"
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

                    {/* Footer / Summary Section */}
                    <div className="shrink-0 mt-3 pt-3 border-t border-gray-200 text-gray-800">
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                <div className="space-y-2">
                                    <p className="text-sm">Total Item(s): <span className="font-bold text-xl">{items.reduce((total, item) => total + item.qty, 0)}</span></p>
                                    <div className="space-y-1 flex items-end gap-4 flex-wrap">
                                        <p className="text-sm">Discount:</p>
                                        <div className="flex-row">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <input
                                                    ref={discountInputRef}
                                                    type="text"
                                                    className={`p-1 rounded-full px-2 w-30 text-black text-center hover:bg-teal-200 border-2 bg-gray-300
                                                        ${discountError ? 'border-red-500' : 'border-gray-300'}`}
                                                    placeholder={discountType === 'flat' ? 'Amount (F8)' : 'Percent (F8)'}
                                                    title="Press F8 to focus"
                                                    value={discount || ''}
                                                    onChange={(e) => handleDiscount(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === '-') e.preventDefault();
                                                    }}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDiscountType(prev => prev === 'flat' ? 'percentage' : 'flat');
                                                        setDiscountError('');
                                                    }}
                                                    className="px-2 py-1 rounded-full bg-teal-600 text-white text-xs hover:bg-teal-700"
                                                    title="Toggle discount type"
                                                >
                                                    {discountType === 'flat' ? 'PKR' : '%'}
                                                </button>
                                            </div>
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
                                <div className="lg:text-right text-sm">
                                    <p>Price: <span className="font-bold">{calculateSubtotal()}</span></p>
                                    <p>Total: <span className="text-red-500 text-2xl font-bold">{calculateTotal()}</span></p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                <button
                                    onClick={handleCancel}
                                    disabled={items.length === 0}
                                    className={`bg-red-500 text-white px-4 py-2 rounded-lg ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600'}`}
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
                                    onClick={holdCurrentBill}
                                    disabled={items.length === 0}
                                    className={`bg-amber-500 text-white px-4 py-2 rounded-lg ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-600'}`}
                                    tabIndex={0}
                                    aria-label="Hold current bill"
                                >
                                    Hold Bill
                                </button>

                                <button
                                    onClick={() => setShowHeldBillsModal(true)}
                                    disabled={heldBills.length === 0}
                                    className={`bg-indigo-500 text-white px-4 py-2 rounded-lg ${heldBills.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-600'}`}
                                    tabIndex={0}
                                    aria-label="Resume held bills"
                                >
                                    Resume Held Bills ({heldBills.length})
                                </button>

                                <button
                                    onClick={handlePayment}
                                    disabled={items.length === 0}
                                    className={`bg-green-500 text-white px-8 py-2 rounded-lg ${items.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-600'}`}
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
                    </div>
                </div>

                {/* Right Section */}
                <div className="bg-gray-200 p-3 rounded-2xl shadow-2xl shadow-neutral-500 h-full min-h-0 overflow-hidden flex flex-col">
                    {/* Right section content */}
                    {/* Search & Filter */}

                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search items by Name"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="p-2 pl-3 mt-2 w-full rounded-3xl text-black bg-white text-center shadow-xl hover:bg-teal-100 text-sm"
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
                    <div className="rounded-2xl mt-3 flex-1 min-h-0 overflow-y-auto p-2 text-gray-500 text-center">
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
                                className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2"
                                role="grid"
                            >
                                {filteredProducts.map((product, index) => (
                                    <div
                                        key={product.id}
                                        data-product-index={index}
                                        onClick={() => getBaseStock(product) > 0 ? addToCartById(product.id) : null}
                                        onKeyDown={(e) => {
                                            switch (e.key) {
                                                case 'Enter':
                                                case ' ':
                                                    e.preventDefault();
                                                    if (getBaseStock(product) > 0) addToCartById(product.id);
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
                                        className={`rounded-lg overflow-hidden shadow-md transition-transform transform hover:scale-102 focus:outline-none focus:ring-2 focus:ring-teal-500 ${selectedIndex === index ? 'ring-2 ring-teal-500' : ''
                                                } ${getBaseStock(product) <= 0 ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'
                                            }`}
                                    >
                                        <div className="relative h-10 bg-white">
                                            {product.photo ? (
                                                <img
                                                    src={product.photo}
                                                    alt={product.name}
                                                    className="w-full h-full object-contain p-1"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                                    <FaImage className="text-black" size={20} />
                                                </div>
                                            )}
                                            {getBaseStock(product) <= 0 && (
                                                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                                                    <span className="bg-red-500 text-white px-1.5 py-0.5 rounded font-bold transform rotate-10 text-[11px]">
                                                        Out of Stock
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2 bg-white">
                                            <h3 className="font-bold text-gray-800 truncate text-[11px]">{product.name}</h3>
                                            <p className="text-teal-600 font-medium text-[11px]">Rs. {product.price.toFixed(2)}</p>
                                            <div className="mt-1 flex justify-items-center">
                                                <p className="text-[11px] text-gray-600">
                                                    {getBaseStock(product) > 0 ? (
                                                        <>
                                                            <span className="font-medium ml-1">Stock:</span> {formatStock(product)}
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
                    items={items.map((item) => ({
                        ...item,
                        formattedQty: formatCartQuantity(item.product || products.find(p => p.id === item.id), item.qty)
                    }))}
                    discount={calculateDiscountAmount()}
                    calculateSubtotal={calculateSubtotal}
                    calculateTotal={calculateTotal}
                    handlePrint={handlePrint}
                    onClose={handleModalClose}
                    saveSale={finalizeSale}
                    orderNumber={orderId} // Pass the order ID directly, no formatting
                />
            )}

            {/* Held Bills Modal */}
            {showHeldBillsModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-[520px] max-h-[70vh] overflow-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold text-gray-800">Held Bills</h2>
                            <button
                                onClick={() => setShowHeldBillsModal(false)}
                                className="text-gray-600 hover:text-red-500"
                                aria-label="Close held bills"
                            >
                                <FaTimes size={20} />
                            </button>
                        </div>

                        {heldBills.length === 0 ? (
                            <p className="text-gray-600">No held bills available.</p>
                        ) : (
                            <div className="space-y-3">
                                {heldBills.map((bill, index) => (
                                    <div key={`${bill.createdAt}-${index}`} className="border rounded-lg p-3 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-gray-800">Bill #{index + 1}</p>
                                            <p className="text-sm text-gray-600">Items: {bill.items.length}</p>
                                            <p className="text-sm text-gray-600">
                                                Total: Rs. {bill.items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Held at: {new Date(bill.createdAt).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => resumeBill(index)}
                                            className="px-3 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
                                        >
                                            Resume
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Quantity Modal */}
            {quantityModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-xl shadow-xl w-96">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">Add to Cart</h2>
                        <p className="text-lg mb-1 text-gray-700">{quantityModal.productName}</p>
                        <p className="text-sm mb-4 text-gray-600">Available: {quantityModal.availableBaseStock} {quantityModal.baseUnitName}</p>

                        <div className="space-y-3 mb-4">
                            {(() => {
                                const product = products.find(p => p.id === quantityModal.productId);
                                if (!product) return null;

                                const config = getUnitConfig(product);
                                const rows = [
                                    {
                                        enabled: true,
                                        label: config.level1Name,
                                        value: level1Qty,
                                        setValue: setLevel1Qty
                                    },
                                    {
                                        enabled: config.unitLevels >= 2,
                                        label: config.level2Name,
                                        value: level2Qty,
                                        setValue: setLevel2Qty
                                    },
                                    {
                                        enabled: config.unitLevels === 3,
                                        label: config.level3Name,
                                        value: level3Qty,
                                        setValue: setLevel3Qty
                                    }
                                ];

                                return rows.filter(row => row.enabled).map((row) => (
                                    <div key={row.label} className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => row.setValue(Math.max(0, row.value - 1))}
                                            className="px-2 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        >
                                            -
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => row.setValue(row.value + 1)}
                                            className="flex-1 px-3 py-2 rounded bg-teal-100 text-teal-800 font-semibold hover:bg-teal-200"
                                        >
                                            {row.label}: {row.value}
                                        </button>
                                    </div>
                                ));
                            })()}

                            <div className="text-sm text-gray-700 font-semibold">
                                Line Total: Rs. {(() => {
                                    const product = products.find(p => p.id === quantityModal.productId);
                                    if (!product) return '0.00';
                                    return calculateSelectedLineTotal(product, level1Qty, level2Qty, level3Qty).toFixed(2);
                                })()}
                            </div>
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

