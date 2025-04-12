"use client";

import { useState, useMemo } from 'react';
import { FaPrint, FaFileExcel, FaFileCsv, FaChartBar } from 'react-icons/fa';
import * as XLSX from 'xlsx';

interface ReportsProps {
    salesData: any[];
    productData: any[];
    dateRange: { start: string; end: string };
}

const Reports: React.FC<ReportsProps> = ({ salesData, productData, dateRange }: ReportsProps) => {
    const [reportType, setReportType] = useState<'sales' | 'inventory' | 'category' | 'daily'>('sales');

    // Function to generate CSV content
    const generateCSV = (data: any[], headers: string[]) => {
        // Create CSV header row
        let csvContent = headers.join(',') + '\n';
        
        // Create data rows
        data.forEach(item => {
            const row = headers.map(header => {
                // Get the value and ensure it's properly formatted for CSV
                const value = item[header] !== undefined ? String(item[header]) : '';
                // Escape quotes and wrap with quotes if it contains comma or quote
                return value.includes(',') || value.includes('"') 
                    ? `"${value.replace(/"/g, '""')}"`
                    : value;
            }).join(',');
            csvContent += row + '\n';
        });
        
        return csvContent;
    };

    // Function to download data as CSV
    const downloadCSV = (csvContent: string, filename: string) => {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Function to export data as Excel
    const exportToExcel = (data: any[], filename: string) => {
        try {
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
            XLSX.writeFile(workbook, `${filename}.xlsx`);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export to Excel. Please try again.');
        }
    };

    // Generate sales report data for different report types
    const generateSalesReport = () => {
        const data = salesData.map(sale => ({
            ID: sale.id || '-',
            Date: new Date(sale.date).toLocaleDateString(),
            'Total Items': sale.items?.length || 0,
            Subtotal: parseFloat(sale.subtotal || 0).toFixed(2),
            Discount: parseFloat(sale.discount || 0).toFixed(2),
            Total: parseFloat(sale.total || 0).toFixed(2)
        }));

        return data;
    };

    // Generate inventory report data
    const generateInventoryReport = () => {
        const data = productData.map(product => ({
            ID: product.id || '-',
            'Product Name': product.name,
            Category: product.category || 'Uncategorized',
            'Current Stock': product.stock || 0,
            Unit: product.unit || '',
            Price: `Rs. ${parseFloat((product.price || 0).toString()).toFixed(2)}`
        }));

        return data;
    };

    // Generate product category report
    const generateCategoryReport = () => {
        // Group products by category
        const categoryMap: Record<string, { count: number, totalValue: number }> = {};
        
        productData.forEach(product => {
            const category = product.category || 'Uncategorized';
            const price = parseFloat((product.price || 0).toString());
            const stock = parseFloat((product.stock || 0).toString());
            const value = price * stock;
            
            if (!categoryMap[category]) {
                categoryMap[category] = { count: 0, totalValue: 0 };
            }
            
            categoryMap[category].count += 1;
            categoryMap[category].totalValue += value;
        });

        // Convert to array for CSV
        const data = Object.entries(categoryMap).map(([category, stats]) => ({
            Category: category,
            'Product Count': stats.count,
            'Total Value': `Rs. ${stats.totalValue.toFixed(2)}`
        }));

        return data;
    };

    // Generate daily sales report
    const generateDailySalesReport = () => {
        // Group sales by date
        const salesByDate: Record<string, { count: number, total: number }> = {};
        
        salesData.forEach(sale => {
            const date = new Date(sale.date).toLocaleDateString();
            const total = parseFloat((sale.total || 0).toString());
            
            if (!salesByDate[date]) {
                salesByDate[date] = { count: 0, total: 0 };
            }
            
            salesByDate[date].count += 1;
            salesByDate[date].total += total;
        });

        // Convert to array for CSV
        const data = Object.entries(salesByDate).map(([date, stats]) => ({
            Date: date,
            'Order Count': stats.count,
            'Total Sales': `Rs. ${stats.total.toFixed(2)}`
        }));

        return data;
    };

    // Get the current report data based on the selected type
    const getCurrentReportData = () => {
        switch (reportType) {
            case 'sales':
                return generateSalesReport();
            case 'inventory':
                return generateInventoryReport();
            case 'category':
                return generateCategoryReport();
            case 'daily':
                return generateDailySalesReport();
            default:
                return [];
        }
    };

    // Handle export to Excel
    const handleExportToExcel = () => {
        try {
            const data = getCurrentReportData();
            const filename = `${reportType}_report_${new Date().toISOString().slice(0, 10)}`;
            exportToExcel(data, filename);
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            alert('Failed to export to Excel. Please try again.');
        }
    };

    // Handle export to CSV
    const handleExportToCSV = () => {
        try {
            const data = getCurrentReportData();
            let headers: string[] = [];
            
            // Get headers from first object
            if (data.length > 0) {
                headers = Object.keys(data[0]);
            }
            
            switch (reportType) {
                case 'sales':
                    headers = ['ID', 'Date', 'Total Items', 'Subtotal', 'Discount', 'Total'];
                    break;
                case 'inventory':
                    headers = ['ID', 'Product Name', 'Category', 'Current Stock', 'Unit', 'Price'];
                    break;
                case 'category':
                    headers = ['Category', 'Product Count', 'Total Value'];
                    break;
                case 'daily':
                    headers = ['Date', 'Order Count', 'Total Sales'];
                    break;
            }
            
            const csvContent = generateCSV(data, headers);
            const filename = `${reportType}_report_${new Date().toISOString().slice(0, 10)}.csv`;
            downloadCSV(csvContent, filename);
        } catch (error) {
            console.error('Error exporting to CSV:', error);
            alert('Failed to export to CSV. Please try again.');
        }
    };

    // Handle print function
    const handlePrintReport = () => {
        const reportData = getCurrentReportData();
        const reportTitle = `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report`;
        
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow pop-ups to print reports');
            return;
        }
        
        let tableHeaders: string[] = [];
        let tableRows = '';
        
        if (reportData.length > 0) {
            tableHeaders = Object.keys(reportData[0]);
            
            // Generate table header row
            const headerRow = `<tr>${tableHeaders.map(header => `<th>${header}</th>`).join('')}</tr>`;
            
            // Generate table rows
            const rows = reportData.map(item => {
                return `<tr>${tableHeaders.map(header => `<td>${(item as Record<string, any>)[header]}</td>`).join('')}</tr>`;
            }).join('');
            
            tableRows = headerRow + rows;
        }
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>${reportTitle}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        h1 { text-align: center; color: #0d9488; }
                        .date-range { text-align: center; margin-bottom: 20px; color: #666; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                        th { background-color: #0d9488; color: white; }
                        tr:nth-child(even) { background-color: #f2f2f2; }
                        .no-data { text-align: center; padding: 40px; color: #666; }
                    </style>
                </head>
                <body>
                    <h1>${reportTitle}</h1>
                    <div class="date-range">Period: ${dateRange.start} to ${dateRange.end}</div>
                    
                    ${reportData.length > 0 
                        ? `<table border="1">
                            ${tableRows}
                          </table>`
                        : '<div class="no-data">No data available for the selected report type and date range.</div>'}
                          
                    <script>
                        setTimeout(() => {
                            window.print();
                            window.close();
                        }, 500);
                    </script>
                </body>
            </html>
        `);
        
        printWindow.document.close();
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Generate Reports</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                    <select 
                        className="w-full p-2 border border-gray-300 text-gray-700 rounded focus:ring-teal-500 focus:border-teal-500"
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value as any)}
                    >
                        <option value="sales">Sales Report</option>
                        <option value="inventory">Inventory Report</option>
                        <option value="category">Category Report</option>
                        <option value="daily">Daily Sales Report</option>
                    </select>
                </div>
                
                <div className="flex items-end">
                    <div className="flex-1 mr-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dateRange.start}
                                readOnly
                                className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-gray-700"
                            />
                        </div>
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <div className="relative">
                            <input 
                                type="date" 
                                value={dateRange.end}
                                readOnly
                                className="w-full p-2 border border-gray-300 rounded bg-gray-100 text-gray-700"
                            />
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Preview of report */}
            <div className="mb-6 border rounded-lg overflow-hidden">
                <div className="bg-gray-50 border-b py-2 px-4 font-medium text-gray-700 flex items-center">
                    <FaChartBar className="mr-2" />
                    Report Preview
                </div>
                <div className="p-4 overflow-x-auto max-h-64">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-300 ">
                            <tr>
                                {getCurrentReportData().length > 0 && 
                                    Object.keys(getCurrentReportData()[0]).map((header, index) => (
                                        <th 
                                            key={index}
                                            scope="col" 
                                            className="px-6 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider"
                                        >
                                            {header}
                                        </th>
                                    ))
                                }
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200 ">
                            {getCurrentReportData().slice(0, 5).map((item, rowIndex) => (
                                <tr key={rowIndex}>
                                    {Object.values(item).map((value, cellIndex) => (
                                        <td 
                                            key={cellIndex}
                                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                                        >
                                            {value}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {getCurrentReportData().length === 0 && (
                        <div className="py-8 text-center text-gray-500">
                            No data available for the selected report type
                        </div>
                    )}
                    {getCurrentReportData().length > 5 && (
                        <div className="mt-2 text-right text-xs text-gray-500">
                            Showing 5 of {getCurrentReportData().length} entries
                        </div>
                    )}
                </div>
            </div>
            
            {/* Export buttons */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={handleExportToExcel}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    disabled={getCurrentReportData().length === 0}
                >
                    <FaFileExcel className="mr-2" />
                    Export to Excel
                </button>
                
                <button
                    onClick={handleExportToCSV}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    disabled={getCurrentReportData().length === 0}
                >
                    <FaFileCsv className="mr-2" />
                    Export to CSV
                </button>
                
                <button
                    onClick={handlePrintReport}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    disabled={getCurrentReportData().length === 0}
                >
                    <FaPrint className="mr-2" />
                    Print Report
                </button>
            </div>
        </div>
    );
};

export default Reports;