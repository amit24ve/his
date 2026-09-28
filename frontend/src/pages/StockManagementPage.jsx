import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// --- NAVIGATION SECTION TITLES ---
const NAV_SECTIONS = [
  { key: "alerts", name: "Low Stock Alerts" },
  { key: "catalogue", name: "Product Catalogue" },
  { key: "logs", name: "Stock In/Out Logs" },
];

const API_BASE = "https://cubehis.avopay.pro:5000/api/stock";
const PAGE_SIZE = 10;

// --- COMPONENTS ---
function InventoryTopTitle({ search, setSearch }) {
  return (
    <motion.div
      className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-left text-blue-700 leading-7 drop-shadow">
          Inventory Management
        </h2>
        <p className="text-gray-500 mt-1 text-left text-xs sm:text-sm md:text-base">
          Manage products, stock, and requisitions efficiently.
        </p>
      </div>
      <div className="mt-3 sm:mt-0 sm:ml-4 w-full sm:w-auto flex justify-start sm:justify-end">
        <motion.input
          type="text"
          placeholder="Search products or SKU"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-64 text-sm shadow-inner"
          whileFocus={{ scale: 1.03, borderColor: "#3b82f6" }}
        />
      </div>
    </motion.div>
  );
}

function PaginationControl({ page, setPage, hasPrev, hasNext, total }) {
  if (total <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between w-full mt-1">
      <motion.button
        onClick={() => setPage(p => Math.max(1, p - 1))}
        disabled={!hasPrev}
        className={`px-4 py-2 rounded shadow font-semibold transition
          ${hasPrev
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
        `}
        style={{ minWidth: 90, fontSize: "0.95rem" }}
        whileTap={{ scale: 0.96 }}
      >
        Previous
      </motion.button>
      <span className="text-sm sm:text-base text-gray-700 font-medium">{`Page ${page}`}</span>
      <motion.button
        onClick={() => setPage(p => p + 1)}
        disabled={!hasNext}
        className={`px-4 py-2 rounded shadow font-semibold transition
          ${hasNext
            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600"
            : "bg-gray-200 text-gray-400 cursor-not-allowed"}
        `}
        style={{ minWidth: 90, fontSize: "0.95rem" }}
        whileTap={{ scale: 0.96 }}
      >
        Next
      </motion.button>
    </div>
  );
}

// --- Add Product Modal (Animated Card) ---
// function AddProductModal({ open, onClose, onAdd }) {
//   const [form, setForm] = useState({
//     name: "",
//     sku: "",
//     warehouse_qty: "",
//     unit: "",
//     category: "",
//     description: "",
//     low_stock_threshold: 10,
//     depots: [{ name: "", qty: "" }],
//   });
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   // Add new depot row
//   const addDepotRow = () => {
//     setForm(f => ({ ...f, depots: [...f.depots, { name: "", qty: "" }] }));
//   };
//   const removeDepotRow = idx => {
//     setForm(f => ({
//       ...f,
//       depots: f.depots.filter((_, i) => i !== idx),
//     }));
//   };
//   const changeDepot = (idx, field, value) => {
//     setForm(f => ({
//       ...f,
//       depots: f.depots.map((d, i) =>
//         i === idx ? { ...d, [field]: value } : d
//       ),
//     }));
//   };
//   const handleChange = e => {
//     const { name, value } = e.target;
//     setForm(f => ({ ...f, [name]: value }));
//   };

//   const handleSubmit = async e => {
//     e.preventDefault();
//     setError("");
//     setLoading(true);

//     if (!form.name || !form.unit) {
//       setError("Name and Unit are required.");
//       setLoading(false);
//       return;
//     }
//     const depot_qty = {};
//     form.depots.forEach(d => {
//       if (d.name && d.qty && !isNaN(d.qty)) depot_qty[d.name] = Number(d.qty);
//     });
//     if (
//       (!form.warehouse_qty || isNaN(form.warehouse_qty) || Number(form.warehouse_qty) <= 0) &&
//       Object.keys(depot_qty).length === 0
//     ) {
//       setError("At least Warehouse Qty or one Depot Qty is required.");
//       setLoading(false);
//       return;
//     }
//     const payload = {
//       name: form.name,
//       sku: form.sku ? form.sku : undefined,
//       warehouse_qty: Number(form.warehouse_qty) || 0,
//       depot_qty: depot_qty,
//       low_stock_threshold: Number(form.low_stock_threshold) || 10,
//       unit: form.unit,
//       category: form.category,
//       description: form.description,
//     };

//     try {
//       const res = await fetch(`${API_BASE}/products`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload)
//       });
//       if (!res.ok) {
//         const err = await res.json();
//         throw new Error(err.detail || "Something went wrong");
//       }
//       setForm({
//         name: "",
//         sku: "",
//         warehouse_qty: "",
//         depots: [{ name: "", qty: "" }],
//         low_stock_threshold: 10,
//         unit: "",
//         category: "",
//         description: "",
//       });
//       onAdd();
//       onClose();
//     } catch (e) {
//       setError(e.message || "Failed to add product");
//     }
//     setLoading(false);
//   };

//   if (!open) return null;
//   return (
//     <AnimatePresence>
//       <motion.div
//         className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center"
//         initial={{ opacity: 0 }}
//         animate={{ opacity: 1 }}
//         exit={{ opacity: 0 }}
//       >
//         <motion.div
//           className="bg-white rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl shadow-2xl relative border-2 border-blue-200 px-4 sm:px-7 py-6 sm:py-10"
//           initial={{ scale: 0.92, opacity: 0, y: 40 }}
//           animate={{ scale: 1, opacity: 1, y: 0 }}
//           exit={{ scale: 0.97, opacity: 0, y: 16, transition: { duration: 0.2 } }}
//         >
//           <button
//             onClick={onClose}
//             className="absolute top-2 right-3 text-gray-500 hover:text-red-500 text-2xl font-bold"
//           >×</button>
//           <div className="flex flex-col items-center mb-3">
//             <div className="bg-gradient-to-r from-blue-500 to-green-400 text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl mb-2 shadow-lg">+</div>
//             <h2 className="text-lg sm:text-2xl font-bold mb-1 text-blue-700 text-center">Add New Product</h2>
//             <p className="text-xs sm:text-sm text-gray-500 mb-2 text-center">
//               Fill the form to add a new stock item to your inventory.
//             </p>
//           </div>
//           <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
//             <div className="flex flex-col sm:flex-row gap-3">
//               <div className="flex-1">
//                 <label className="block text-sm font-medium mb-1">Product Name <span className="text-red-500">*</span></label>
//                 <input name="name" className="border p-2 rounded w-full" value={form.name} onChange={handleChange} placeholder="e.g. Engine Oil" required />
//               </div>
//               <div className="flex-1">
//                 <label className="block text-sm font-medium mb-1">SKU</label>
//                 <input name="sku" className="border p-2 rounded w-full" value={form.sku} onChange={handleChange} placeholder="Optional or auto-generated" />
//               </div>
//             </div>
//             <div className="flex flex-col sm:flex-row gap-3">
//               <div className="flex-1">
//                 <label className="block text-sm font-medium mb-1">Unit <span className="text-red-500">*</span></label>
//                 <input name="unit" className="border p-2 rounded w-full" value={form.unit} onChange={handleChange} placeholder="e.g. Litre" required />
//               </div>
//               <div className="flex-1">
//                 <label className="block text-sm font-medium mb-1">Category</label>
//                 <input name="category" className="border p-2 rounded w-full" value={form.category} onChange={handleChange} placeholder="e.g. Lubricant" />
//               </div>
//             </div>
//             <div>
//               <label className="block text-sm font-medium mb-1">Description</label>
//               <textarea name="description" className="border p-2 rounded w-full" value={form.description} onChange={handleChange} placeholder="Description of product" rows={2} />
//             </div>
//             <div className="flex flex-col sm:flex-row gap-3">
//               <div className="flex-1">
//                 <label className="block text-sm font-medium mb-1">Warehouse Quantity</label>
//                 <input name="warehouse_qty" className="border p-2 rounded w-full" type="number" min="0" value={form.warehouse_qty} onChange={handleChange} placeholder="e.g. 120" />
//               </div>
//               <div className="flex-1">
//                 <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
//                 <input name="low_stock_threshold" className="border p-2 rounded w-full" type="number" min="1" value={form.low_stock_threshold} onChange={handleChange} placeholder="e.g. 10" />
//               </div>
//             </div>
//             <div>
//               <label className="block text-sm font-medium mb-1">Depot Stock</label>
//               <div>
//                 {form.depots.map((d, idx) => (
//                   <div key={idx} className="flex gap-2 mb-1">
//                     <input className="border p-2 rounded w-1/2" placeholder="Depot" value={d.name} onChange={e => changeDepot(idx, "name", e.target.value)} />
//                     <input className="border p-2 rounded w-1/2" type="number" min="0" placeholder="Qty" value={d.qty} onChange={e => changeDepot(idx, "qty", e.target.value)} />
//                     <button type="button" className="text-red-500 font-bold" onClick={() => removeDepotRow(idx)} disabled={form.depots.length === 1}>×</button>
//                   </div>
//                 ))}
//                 <button type="button" className="text-xs text-blue-600 underline" onClick={addDepotRow}>+ Add Depot</button>
//               </div>
//             </div>
//             {error && <div className="text-red-600 text-sm">{error}</div>}
//             <motion.button
//               type="submit"
//               disabled={loading}
//               className="w-full bg-gradient-to-r from-blue-600 to-green-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-green-500"
//               whileHover={{ scale: 1.03 }}
//               whileTap={{ scale: 0.97 }}
//             >
//               {loading ? "Adding..." : "Add Product"}
//             </motion.button>
//           </form>
//         </motion.div>
//       </motion.div>
//     </AnimatePresence>
//   );
// }



function AddProductModal({ open, onClose, onAdd }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    warehouse_qty: "",
    unit: "",
    category: "",
    description: "",
    low_stock_threshold: 10,
    depots: [{ name: "", qty: "" }],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addDepotRow = () => {
    setForm(f => ({ ...f, depots: [...f.depots, { name: "", qty: "" }] }));
  };
  const removeDepotRow = idx => {
    setForm(f => ({
      ...f,
      depots: f.depots.filter((_, i) => i !== idx),
    }));
  };
  const changeDepot = (idx, field, value) => {
    setForm(f => ({
      ...f,
      depots: f.depots.map((d, i) =>
        i === idx ? { ...d, [field]: value } : d
      ),
    }));
  };
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!form.name || !form.unit) {
      setError("Name and Unit are required.");
      setLoading(false);
      return;
    }
    const depot_qty = {};
    form.depots.forEach(d => {
      if (d.name && d.qty && !isNaN(d.qty)) depot_qty[d.name] = Number(d.qty);
    });
    if (
      (!form.warehouse_qty || isNaN(form.warehouse_qty) || Number(form.warehouse_qty) <= 0) &&
      Object.keys(depot_qty).length === 0
    ) {
      setError("At least Warehouse Qty or one Depot Qty is required.");
      setLoading(false);
      return;
    }
    const payload = {
      name: form.name,
      sku: form.sku ? form.sku : undefined,
      warehouse_qty: Number(form.warehouse_qty) || 0,
      depot_qty: depot_qty,
      low_stock_threshold: Number(form.low_stock_threshold) || 10,
      unit: form.unit,
      category: form.category,
      description: form.description,
    };

    try {
      const res = await fetch(`https://cubehis.avopay.pro:5000/api/stock/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Something went wrong");
      }
      setForm({
        name: "",
        sku: "",
        warehouse_qty: "",
        depots: [{ name: "", qty: "" }],
        low_stock_threshold: 10,
        unit: "",
        category: "",
        description: "",
      });
      onAdd();
      onClose();
    } catch (e) {
      setError(e.message || "Failed to add product");
    }
    setLoading(false);
  };

  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="bg-gradient-to-br from-blue-50 via-white to-blue-100 rounded-2xl w-full max-w-xs sm:max-w-lg md:max-w-2xl shadow-2xl relative border-2 border-blue-400 px-4 sm:px-7 py-6 sm:py-10"
          initial={{ scale: 0.92, opacity: 0, y: 40 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 16, transition: { duration: 0.2 } }}
        >
          <button
            onClick={onClose}
            className="absolute top-2 right-3 text-blue-400 hover:text-red-500 text-2xl font-bold"
          >×</button>
          <div className="flex flex-col items-center mb-3">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 text-white rounded-full w-14 h-14 flex items-center justify-center text-3xl mb-2 shadow-lg">+</div>
            <h2 className="text-lg sm:text-2xl font-bold mb-1 text-blue-700 text-center">Add New Product</h2>
            <p className="text-xs sm:text-sm text-blue-500 mb-2 text-center">
              Fill the form to add a new stock item to your inventory.
            </p>
          </div>
          <form className="space-y-3" onSubmit={handleSubmit} autoComplete="off">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Product Name <span className="text-red-500">*</span></label>
                <input name="name" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" value={form.name} onChange={handleChange} placeholder="e.g. Engine Oil" required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">SKU</label>
                <input name="sku" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" value={form.sku} onChange={handleChange} placeholder="Optional or auto-generated" />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Unit <span className="text-red-500">*</span></label>
                <input name="unit" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" value={form.unit} onChange={handleChange} placeholder="e.g. Litre" required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Category</label>
                <input name="category" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" value={form.category} onChange={handleChange} placeholder="e.g. Lubricant" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea name="description" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" value={form.description} onChange={handleChange} placeholder="Description of product" rows={2} />
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Warehouse Quantity</label>
                <input name="warehouse_qty" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" type="number" min="0" value={form.warehouse_qty} onChange={handleChange} placeholder="e.g. 120" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">Low Stock Threshold</label>
                <input name="low_stock_threshold" className="border p-2 rounded w-full bg-blue-50 focus:border-blue-400" type="number" min="1" value={form.low_stock_threshold} onChange={handleChange} placeholder="e.g. 10" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Depot Stock</label>
              <div>
                {form.depots.map((d, idx) => (
                  <div key={idx} className="flex gap-2 mb-1">
                    <input className="border p-2 rounded w-1/2 bg-blue-50 focus:border-blue-400" placeholder="Depot" value={d.name} onChange={e => changeDepot(idx, "name", e.target.value)} />
                    <input className="border p-2 rounded w-1/2 bg-blue-50 focus:border-blue-400" type="number" min="0" placeholder="Qty" value={d.qty} onChange={e => changeDepot(idx, "qty", e.target.value)} />
                    <button type="button" className="text-red-500 font-bold" onClick={() => removeDepotRow(idx)} disabled={form.depots.length === 1}>×</button>
                  </div>
                ))}
                <button type="button" className="text-xs text-blue-600 underline" onClick={addDepotRow}>+ Add Depot</button>
              </div>
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-400 text-white font-semibold rounded px-4 py-2 mt-2 shadow-sm hover:from-blue-700 hover:to-blue-500"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {loading ? "Adding..." : "Add Product"}
            </motion.button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// TABLE COMPONENTS -- responsive, animated
function ProductInventoryTable({ products, search, page, setPage, hasPrev, hasNext, onAddProduct }) {
  const filtered = products.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allDepots = Array.from(
    new Set(
      products.flatMap(
        p => (p.depot_qty ? Object.keys(p.depot_qty) : [])
      )
    )
  );

  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-blue-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between px-2 sm:px-6 py-3 border-b">
        <h3 className="text-lg font-bold text-blue-700">Product Catalogue & Inventory</h3>
        <motion.button
          onClick={onAddProduct}
          className="bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 text-white font-bold rounded-lg px-4 py-2 text-sm shadow mt-3 sm:mt-0"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          + Add Product
        </motion.button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[700px] w-full text-[0.92rem]">
          <thead className="bg-gradient-to-r from-blue-50 to-green-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Date</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Product</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">SKU</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Warehouse</th>
              {allDepots.map(depot => (
                <th key={depot} className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">{`Depot ${depot}`}</th>
              ))}
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Unit</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Category</th>
              <th className="px-2 sm:px-4 py-2 text-center text-xs font-semibold text-blue-700 uppercase">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={8 + allDepots.length} className="py-2 text-center text-gray-400">
                  No products found.
                </td>
              </tr>
            )}
            {paginated.map((p, i) => (
              <motion.tr
                key={p.product_id || p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, type: "spring", stiffness: 120, damping: 14 }}
                className="hover:bg-blue-50 transition"
              >
                <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">
                  {p.date ? new Date(p.date).toLocaleDateString() : ""}
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{p.name}</td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.sku}</td>
                {/* Warehouse cell with red/green badge */}
                <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm">
                  <span className={
                    p.warehouse_qty < (p.low_stock_threshold || 10)
                      ? "bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold"
                      : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold"
                  }>
                    {p.warehouse_qty}
                  </span>
                </td>
                {/* Depot cells with red/green badge */}
                {allDepots.map(depot => {
                  const depotQty = p.depot_qty && p.depot_qty[depot] ? p.depot_qty[depot] : 0;
                  return (
                    <td key={depot} className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm">
                      <span className={
                        depotQty < (p.low_stock_threshold || 10)
                          ? "bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold"
                          : "bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold"
                      }>
                        {depotQty}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.unit}</td>
                <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.category}</td>
                <td className="px-2 sm:px-4 py-2 text-center whitespace-nowrap text-xs sm:text-sm text-gray-500">{p.description}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 mb-2">
        <PaginationControl
          page={page}
          setPage={setPage}
          hasPrev={hasPrev}
          hasNext={hasNext}
          total={filtered.length}
        />
      </div>
    </motion.div>
  );
}

function LowStockAlerts({ alerts, page, setPage, hasPrev, hasNext }) {
  let rows = [];
  if (Array.isArray(alerts)) {
    rows = alerts;
  } else if (alerts && typeof alerts === "object") {
    rows = Object.values(alerts).flat();
  }
  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-red-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="px-2 sm:px-6 py-3 flex items-center gap-2 border-b">
        <svg className="h-5 w-5 sm:h-6 sm:w-6 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.668 1.732-3L13.732 4c-.77-1.332-2.694-1.332-3.464 0L3.34 16c-.77 1.332.192 3 1.732 3z" />
        </svg>
        <h3 className="text-lg font-bold text-red-600">Low Stock Alerts</h3>
      </div>
      <div className="px-2 sm:px-6 py-3">
        <div className="grid gap-3">
          {paginated.length === 0 && (
            <span className="text-green-700 text-sm">All stocks are above threshold.</span>
          )}
          {paginated.map((alert, idx) => (
            <motion.div
              key={idx}
              className="bg-red-50 border border-red-200 rounded-xl px-2 sm:px-4 py-2 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02 }}
            >
              <span className="text-[0.98rem]">
                <b>{alert.product_name}</b> (ID: {alert.product_id}){alert.location ? ` [${alert.location}]` : ""}: Low stock - <span className="font-semibold text-red-700">{alert.quantity}</span> (Threshold: <span className="font-semibold">{alert.threshold}</span>)
              </span>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="mt-4 mb-2">
        <PaginationControl
          page={page}
          setPage={setPage}
          hasPrev={hasPrev}
          hasNext={hasNext}
          total={rows.length}
        />
      </div>
    </motion.div>
  );
}


function StockLogs({ logs, page, setPage, hasPrev, hasNext }) {
  const paginated = logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <motion.div
      className="bg-white shadow-lg rounded-2xl mb-6 border border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
    >
      <div className="px-2 sm:px-6 py-3 border-b">
        <h3 className="text-lg font-bold text-blue-700">Stock In/Out Logs</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[350px] sm:min-w-[600px] md:min-w-[860px] w-full text-xs sm:text-[0.92rem]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Date</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Product</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Type</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Qty</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Location</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">By</th>
              <th className="px-2 sm:px-4 py-2 text-left text-xs font-semibold text-blue-700 uppercase">Remarks</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={7} className="py-2 text-center text-gray-400">
                  No logs found.
                </td>
              </tr>
            )}
            {paginated.map((log, idx) => (
              <motion.tr
                key={log.log_id || log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="hover:bg-gray-50 transition"
              >
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                  {log.date ? new Date(log.date).toLocaleDateString() : ""}
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{log.product_name || log.product_id}</td>
                <td className={`px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm font-semibold ${log.type === "in" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"} rounded`}>
                  {log.type?.toUpperCase()}
                </td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{log.quantity}</td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{log.location}</td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{log.by}</td>
                <td className="px-2 sm:px-4 py-2 whitespace-nowrap text-xs sm:text-sm text-gray-500">{log.remarks || ""}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 mb-2">
        <PaginationControl
          page={page}
          setPage={setPage}
          hasPrev={hasPrev}
          hasNext={hasNext}
          total={logs.length}
        />
      </div>
    </motion.div>
  );
}

export default function InventoryManagement() {
  const [activeTab, setActiveTab] = useState("alerts");
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Pagination
  const [alertsPage, setAlertsPage] = useState(1);
  const [productsPage, setProductsPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  // Add Product Modal
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Fetch all products
  const fetchProducts = () => {
    setLoadingProducts(true);
    fetch(`${API_BASE}/products`)
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoadingProducts(false));
  };
  useEffect(() => { fetchProducts(); }, []);
  useEffect(() => {
    setLoadingAlerts(true);
    fetch(`${API_BASE}/alerts`)
      .then(res => res.json())
      .then(data => {
        if (data.low_stock_alerts) {
          const all = Object.values(data.low_stock_alerts).flat();
          setAlerts(all);
        } else {
          setAlerts([]);
        }
      })
      .finally(() => setLoadingAlerts(false));
  }, []);
  useEffect(() => {
    setLoadingLogs(true);
    fetch(`${API_BASE}/logs`)
      .then(res => res.json())
      .then(data => setLogs((data.logs || [])))
      .finally(() => setLoadingLogs(false));
  }, []);

  // Pagination controls
  const alertsHasPrev = alertsPage > 1;
  const alertsHasNext = alerts.length > alertsPage * PAGE_SIZE;
  const productsFiltered = products.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()))
  );
  const productsHasPrev = productsPage > 1;
  const productsHasNext = productsFiltered.length > productsPage * PAGE_SIZE;
  const logsHasPrev = logsPage > 1;
  const logsHasNext = logs.length > logsPage * PAGE_SIZE;

  // Reset pages on search or tab change
  useEffect(() => { setProductsPage(1); }, [search, activeTab]);
  useEffect(() => { setAlertsPage(1); }, [activeTab]);
  useEffect(() => { setLogsPage(1); }, [activeTab]);

  return (
    <motion.div
      className="bg-gray-50 min-h-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
    >
      <AddProductModal
        open={showAddProduct}
        onClose={() => setShowAddProduct(false)}
        onAdd={fetchProducts}
      />
      <div className="max-w-full sm:max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 pt-4">
        <InventoryTopTitle search={search} setSearch={setSearch} />
        <motion.div
          className="border-b border-gray-200 bg-white mt-3 overflow-x-auto"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18 }}
        >
          <nav className="-mb-px flex flex-row flex-nowrap space-x-2 sm:space-x-6">
            {NAV_SECTIONS.map(tab => (
              <motion.button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`${activeTab === tab.key
                    ? 'border-b-2 border-blue-500 text-blue-700 font-semibold'
                    : 'border-b-2 border-transparent text-gray-700 hover:text-blue-600 hover:border-blue-300'
                  } whitespace-nowrap py-2 px-2 sm:py-3 sm:px-4 font-medium text-xs sm:text-base text-left transition focus:outline-none`}
                style={{ minWidth: 90 }}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
              >
                {tab.name}
              </motion.button>
            ))}
          </nav>
        </motion.div>
        <div className="py-4">
          <AnimatePresence mode="wait">
            {activeTab === "alerts" &&
              (loadingAlerts
                ? <motion.div key="loading-alerts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Loading...</motion.div>
                : <LowStockAlerts
                  key="alerts"
                  alerts={alerts}
                  page={alertsPage}
                  setPage={setAlertsPage}
                  hasPrev={alertsHasPrev}
                  hasNext={alertsHasNext}
                />
              )}
            {activeTab === "catalogue" &&
              (loadingProducts
                ? <motion.div key="loading-products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Loading...</motion.div>
                : <ProductInventoryTable
                  key="catalogue"
                  products={products}
                  search={search}
                  page={productsPage}
                  setPage={setProductsPage}
                  hasPrev={productsHasPrev}
                  hasNext={productsHasNext}
                  onAddProduct={() => setShowAddProduct(true)}
                />
              )}
            {activeTab === "logs" &&
              (loadingLogs
                ? <motion.div key="loading-logs" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>Loading...</motion.div>
                : <StockLogs
                  key="logs"
                  logs={logs}
                  page={logsPage}
                  setPage={setLogsPage}
                  hasPrev={logsHasPrev}
                  hasNext={logsHasNext}
                />
              )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
