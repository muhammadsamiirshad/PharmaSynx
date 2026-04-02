const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./pharmacy.db');

const categories = [
  { name: 'Tablets', unit_levels: 3, l1: 'Box', l2: 'Strip', l3: 'Tablet', c12: 10, c23: 10 },
  { name: 'Capsules', unit_levels: 3, l1: 'Box', l2: 'Strip', l3: 'Capsule', c12: 10, c23: 10 },
  { name: 'Syrups', unit_levels: 1, l1: 'Bottle', l2: null, l3: null, c12: 1, c23: 1 },
  { name: 'Injections', unit_levels: 2, l1: 'Box', l2: 'Vial', l3: null, c12: 5, c23: 1 },
  { name: 'Ointments/Creams', unit_levels: 1, l1: 'Tube', l2: null, l3: null, c12: 1, c23: 1 },
  { name: 'Drops', unit_levels: 1, l1: 'Bottle', l2: null, l3: null, c12: 1, c23: 1 },
  { name: 'General Items', unit_levels: 1, l1: 'Piece', l2: null, l3: null, c12: 1, c23: 1 }
];

const products = [
  // Brand, Generic, CategoryName, PriceBox, PriceStrip, PriceTablet/Smallest, BaseStock
  ['Panadol 500mg', 'Paracetamol', 'Tablets', 400, 40, 4, 1000],
  ['Panadol CF', 'Paracetamol/Pseudoephedrine', 'Tablets', 500, 50, 5, 500],
  ['Brufen 400mg', 'Ibuprofen', 'Tablets', 600, 60, 6, 800],
  ['Augmentin 625mg', 'Amoxicillin/Clavulanate', 'Tablets', 1200, 200, 20, 200],
  ['Flagyl 400mg', 'Metronidazole', 'Tablets', 300, 30, 3, 1000],
  ['Arinac Forte', 'Ibuprofen/Pseudoephedrine', 'Tablets', 450, 45, 4.5, 400],
  ['Ponstan Forte', 'Mefenamic Acid', 'Tablets', 350, 35, 3.5, 1000],
  ['Risek 40mg', 'Omeprazole', 'Capsules', 800, 80, 8, 300],
  ['Amoxil 250mg', 'Amoxicillin', 'Capsules', 400, 40, 4, 500],
  ['Ceevit', 'Vitamin C', 'Tablets', 200, 20, 2, 1000],
  ['Surbex-Z', 'Multivitamins', 'Tablets', 550, 55, 5.5, 300],
  ['Hydryllin Syrup', 'Aminophylline/Diphenhydramine', 'Syrups', 120, 0, 120, 50],
  ['Cac 1000 Plus', 'Calcium/Vitamin C', 'Tablets', 450, 0, 45, 100], // Effervescent
  ['Polyfax Skin', 'Polymyxin B/Bacitracin', 'Ointments/Creams', 80, 0, 80, 40],
  ['Ventolin Inhaler', 'Salbutamol', 'General Items', 350, 0, 350, 30],
  ['Disprin', 'Aspirin', 'Tablets', 200, 20, 0.5, 2000],
  ['Calpol Syrup', 'Paracetamol', 'Syrups', 90, 0, 90, 60],
  ['Septran DS', 'Co-trimoxazole', 'Tablets', 300, 30, 3, 500],
  ['Entamizole', 'Metronidazole/Diloxanide', 'Tablets', 400, 40, 4, 600],
  ['Gaviscon Liquid', 'Sodium Alginate', 'Syrups', 250, 0, 250, 40],
  ['Gravinate', 'Dimenhydrinate', 'Tablets', 150, 15, 1.5, 1000],
  ['Lowplat 75mg', 'Clopidogrel', 'Tablets', 900, 90, 9, 200],
  ['Myteka 10mg', 'Montelukast', 'Tablets', 800, 80, 8, 300],
  ['No-Spa 40mg', 'Drotaverine', 'Tablets', 400, 40, 4, 500],
  ['Softin 10mg', 'Loratadine', 'Tablets', 300, 30, 3, 400],
  ['Xobix 15mg', 'Meloxicam', 'Tablets', 500, 50, 5, 200]
];

db.serialize(() => {
  console.log("Cleaning old data...");
  db.run("DELETE FROM products");
  db.run("DELETE FROM categories");

  console.log("Seeding Pakistani Categories...");
  const catMap = {};
  const stmtCat = db.prepare(`INSERT INTO categories (name, unit_levels, level_1_name, level_2_name, level_3_name, conversion_1_to_2, conversion_2_to_3) VALUES (?, ?, ?, ?, ?, ?, ?)`);
  
  categories.forEach(c => {
    stmtCat.run(c.name, c.unit_levels, c.l1, c.l2, c.l3, c.c12, c.c23, function(err) {
      if (!err) catMap[c.name] = this.lastID;
    });
  });
  stmtCat.finalize();

  // Short delay to ensure IDs are mapped
  setTimeout(() => {
    console.log("Seeding Medicines...");
    const stmtProd = db.prepare(`INSERT INTO products (name, generic_name, category_id, price_per_box, price_per_strip, price_per_tablet, base_stock) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    
    products.forEach(p => {
      const catId = catMap[p[2]];
      if (catId) {
        stmtProd.run(p[0], p[1], catId, p[3], p[4], p[5], p[6]);
      }
    });
    stmtProd.finalize();
    console.log("Seeding Complete! Thousands can be added by expanding the products array.");
    db.close();
  }, 1000);
});