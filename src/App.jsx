import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import {
  Sparkles,
  ShoppingBag,
  Plus,
  Search,
  Send,
  MapPin,
  User,
  DollarSign,
  CheckCircle2,
  X,
  Tag,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(val || 0);
};

export default function App() {
  const [products, setProducts] = useState([]);
  const [promos, setPromos] = useState([]);

  // CARRITO LOCAL E INDEPENDIENTE POR DISPOSITIVO
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('benga_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('benga_cart', JSON.stringify(cart));
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  }, [cart]);

  // BÚSQUEDA Y FILTRADO
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');

  // 🧊 ESTADO PARA LA MINI PESTAÑITA DE SELECCIÓN DE HIELO
  const [showIceSelector, setShowIceSelector] = useState(false);

  // DATOS DEL CLIENTE
  const [clientName, setClientName] = useState('');
  const [deliveryType, setDeliveryType] = useState('retiro'); // 'retiro' o 'envio'
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [paidEfectivo, setPaidEfectivo] = useState('');
  const [paidTransferencia, setPaidTransferencia] = useState('');

  // MODALES
  const [showCartModal, setShowCartModal] = useState(false);
  const [orderSentSuccess, setOrderSentSuccess] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      setProducts(list);
    });

    const unsubPromos = onSnapshot(collection(db, 'promos'), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
      setPromos(list);
    });

    return () => {
      unsubProducts();
      unsubPromos();
    };
  }, []);

  const isPromoOutOfStock = (promo) => {
    if (!promo.items || promo.items.length === 0) return false;
    return promo.items.some((comp) => {
      const pObj = products.find((p) => p.id === comp.productId);
      return !pObj || Number(pObj.stock ?? 0) < Number(comp.quantity || 1);
    });
  };

  const hasPromoInCart = useMemo(() => {
    return cart.some((item) => 
      item.type === 'promo' || 
      item.isPromo || 
      (item.name || '').toLowerCase().includes('combo') ||
      (item.raw?.category || '').toLowerCase().includes('promo')
    );
  }, [cart]);

  const processedCart = useMemo(() => {
    return cart.map((item) => {
      if (item.type === 'product' || !item.isPromo) {
        const comboP = Number(item.raw?.comboPrice || item.comboPrice || 0);
        const normalP = Number(item.raw?.sellPrice || item.raw?.price || item.sellPrice || item.price || 0);
        const isDiscountApplied = hasPromoInCart && comboP > 0;
        const effectivePrice = isDiscountApplied ? comboP : normalP;

        return {
          ...item,
          price: effectivePrice,
          normalPrice: normalP,
          isDiscountApplied
        };
      }
      return {
        ...item,
        price: Number(item.price || 0),
        isDiscountApplied: false
      };
    });
  }, [cart, hasPromoInCart]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    return ['Todas', '🔥 Promos & Combos', ...cats];
  }, [products]);

  const filteredCatalog = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const promoMatches = (pr) => {
      if (!term) return true;
      const nameMatch = (pr.name || '').toLowerCase().includes(term);
      const descMatch = (pr.description || '').toLowerCase().includes(term);
      const itemsMatch = (pr.items || []).some((item) => {
        const pObj = products.find((p) => p.id === item.productId);
        if (!pObj) return false;
        return (
          (pObj.name || '').toLowerCase().includes(term) ||
          (pObj.brand || '').toLowerCase().includes(term)
        );
      });
      return nameMatch || descMatch || itemsMatch;
    };

    if (selectedCategory === '🔥 Promos & Combos') {
      return promos.filter(promoMatches).map((pr) => ({ ...pr, isPromo: true }));
    }

    let matchingPromos = [];
    if (selectedCategory === 'Todas' && term) {
      matchingPromos = promos.filter(promoMatches).map((pr) => ({ ...pr, isPromo: true }));
    }

    let prods = products.filter((p) => {
      if (!term) return true;
      return (
        (p.name || '').toLowerCase().includes(term) ||
        (p.brand || '').toLowerCase().includes(term) ||
        (p.category || '').toLowerCase().includes(term)
      );
    });

    if (selectedCategory !== 'Todas') {
      prods = prods.filter((p) => p.category === selectedCategory);
    }

    const matchingProducts = prods.map((p) => ({ ...p, isPromo: false }));

    return [...matchingPromos, ...matchingProducts];
  }, [products, promos, searchTerm, selectedCategory]);

  const addToCart = (item) => {
    if (item.isPromo) {
      if (isPromoOutOfStock(item)) {
        alert('Este combo no se puede seleccionar porque uno o más productos se encuentran sin stock.');
        return;
      }
    } else {
      const freshProduct = products.find((p) => p.id === item.id);
      const currentStock = Number(freshProduct?.stock ?? item.stock ?? 0);

      const existingInCart = cart.find((i) => i.id === item.id && !i.isPromo);
      const currentQtyInCart = existingInCart ? existingInCart.qty : 0;

      if (currentQtyInCart + 1 > currentStock) {
        alert(`No podés agregar más unidades. Stock disponible: ${currentStock}`);
        return;
      }
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id && i.isPromo === item.isPromo);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id && i.isPromo === item.isPromo ? { ...i, qty: i.qty + 1 } : i
        );
      }

      let price = item.isPromo ? item.price : (item.sellPrice || item.price || 0);
      let cost = item.isPromo
        ? (item.items || []).reduce((acc, comp) => {
            const pObj = products.find((p) => p.id === comp.productId);
            const pCost = pObj ? (pObj.costPrice ?? pObj.cost ?? 0) : 0;
            return acc + (pCost * comp.quantity);
          }, 0)
        : (item.costPrice ?? item.cost ?? 0);

      return [
        ...prev,
        {
          id: item.id,
          name: item.name,
          price,
          comboPrice: item.comboPrice || 0,
          cost,
          qty: 1,
          type: item.isPromo ? 'promo' : 'product',
          raw: item
        }
      ];
    });
  };

  const handleAddSuggested = (keywords) => {
    const foundProduct = products.find(p =>
      keywords.some(kw => (p.name || '').toLowerCase().includes(kw)) && Number(p.stock ?? 0) > 0
    );

    if (foundProduct) {
      addToCart({ ...foundProduct, isPromo: false });
    } else {
      alert('El producto sugerido se encuentra sin stock actualmente.');
    }
  };

  const iceOptions = useMemo(() => {
    return products.filter(p => 
      ((p.name || '').toLowerCase().includes('hielo') || (p.category || '').toLowerCase().includes('hielo'))
    );
  }, [products]);

  const updateQty = (id, isPromo, delta) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id && (item.type === 'promo') === isPromo) {
            const newQty = item.qty + delta;
            if (newQty <= 0) return null;

            if (!isPromo) {
              const freshProduct = products.find((p) => p.id === id);
              const currentStock = Number(freshProduct?.stock ?? 0);
              if (delta > 0 && newQty > currentStock) {
                alert(`Stock máximo alcanzado. Solo hay ${currentStock} unidades disponibles.`);
                return item;
              }
            }

            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const cartTotal = useMemo(() => {
    return processedCart.reduce((acc, i) => acc + i.price * i.qty, 0);
  }, [processedCart]);

  const totalItemsCount = useMemo(() => {
    return processedCart.reduce((acc, i) => acc + i.qty, 0);
  }, [processedCart]);

  const handleEfectivoChange = (val) => {
    setPaidEfectivo(val);
    const num = parseFloat(val) || 0;
    const remaining = Math.max(0, cartTotal - num);
    setPaidTransferencia(remaining > 0 ? remaining.toString() : '0');
  };

  const handleTransferenciaChange = (val) => {
    setPaidTransferencia(val);
    const num = parseFloat(val) || 0;
    const remaining = Math.max(0, cartTotal - num);
    setPaidEfectivo(remaining > 0 ? remaining.toString() : '0');
  };

  // 🚀 FUNCIÓN PARA OBTENER EL NÚMERO DE PEDIDO (EMPIEZA EN 65)
  const getNextOrderNumber = async () => {
    const counterRef = doc(db, 'counters', 'orderCounter');
    const counterSnap = await getDoc(counterRef);

    if (!counterSnap.exists()) {
      await setDoc(counterRef, { current: 65 });
      return 65;
    } else {
      await updateDoc(counterRef, { current: increment(1) });
      const updatedSnap = await getDoc(counterRef);
      return updatedSnap.data().current;
    }
  };

  const handleSendOrder = async (e) => {
    e.preventDefault();
    if (processedCart.length === 0) return;

    if (!clientName.trim()) {
      alert('Por favor ingresá tu nombre para saber a quién va el pedido.');
      return;
    }

    setIsSending(true);

    try {
      // 1. Obtener número de pedido correlativo (desde 65)
      const orderNumber = await getNextOrderNumber();

      const efec = parseFloat(paidEfectivo) || 0;
      const transf = parseFloat(paidTransferencia) || 0;

      const newOrder = {
        orderNumber: orderNumber, // Guardamos el número en Firebase para tu panel admin
        clientName: clientName.trim(),
        deliveryType: deliveryType,
        address: deliveryType === 'envio' ? address.trim() : 'Retira en el local',
        paymentMethod,
        paidEfectivo: paymentMethod === 'Mixto' ? efec : (paymentMethod === 'Efectivo' ? cartTotal : 0),
        paidTransferencia: paymentMethod === 'Mixto' ? transf : (paymentMethod === 'Transferencia' ? cartTotal : 0),
        items: processedCart,
        total: cartTotal,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // 2. Guardar en Firestore
      await addDoc(collection(db, 'orders'), newOrder);

      // 3. Armar mensaje corto a tu WhatsApp (solo aviso con número, sin resumen)
      const waMessage = `¡Hola! Te hice un nuevo pedido N° ${orderNumber}`;

      const phoneNumber = '5491140821173'; 
      const waUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(waMessage)}`;

      setOrderSentSuccess(true);
      setShowCartModal(false);
      setCart([]);
      localStorage.removeItem('benga_cart');

      window.open(waUrl, '_blank');
    } catch (err) {
      console.error(err);
      alert('Hubo un error al enviar tu pedido. Revisa tu conexión.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-32 antialiased relative">
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 py-4 shadow-xl">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="font-black text-xl text-fuchsia-400 tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-5 h-5" /> BENGA DRINKS
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">Hacé tu pedido online rápido y fácil 🍹</p>
          </div>

          <button
            onClick={() => setShowCartModal(true)}
            className="relative bg-fuchsia-500 hover:bg-fuchsia-400 text-slate-950 font-bold p-3 rounded-2xl transition shadow-lg shadow-fuchsia-500/20"
          >
            <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-white text-fuchsia-600 font-mono font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-950">
                {totalItemsCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar fernet, vodka, combos, hielo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition shadow-inner"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition border ${
                selectedCategory === cat
                  ? 'bg-fuchsia-500 text-slate-950 border-fuchsia-400 shadow-md shadow-fuchsia-500/20'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {hasPromoInCart && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-2xl flex items-center gap-2 text-xs text-amber-300">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>¡Llevás una promo! Se aplicó precio con descuento en tu hielo o agregados.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {filteredCatalog.map((item) => {
            const outOfStock = item.isPromo ? isPromoOutOfStock(item) : Number(item.stock ?? 0) <= 0;
            const hasComboDiscount = !item.isPromo && hasPromoInCart && item.comboPrice > 0;
            const displayPrice = item.isPromo
              ? item.price
              : (hasComboDiscount ? item.comboPrice : (item.sellPrice || item.price));

            return (
              <div
                key={`${item.isPromo ? 'pr' : 'prod'}-${item.id}`}
                className={`border rounded-3xl overflow-hidden transition flex flex-col justify-between shadow-xl ${
                  outOfStock 
                    ? 'opacity-60 bg-slate-950 border-slate-800 grayscale' 
                    : item.isPromo
                      ? 'bg-fuchsia-950/20 border-fuchsia-500/40'
                      : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="h-32 bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800/80">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-700 flex flex-col items-center gap-1">
                      <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                      <span className="text-[9px] uppercase font-bold text-slate-600">Sin Foto</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase text-fuchsia-400 border border-slate-800">
                    {item.isPromo ? '🔥 Promo' : item.brand}
                  </span>

                  {outOfStock && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-[10px] px-2.5 py-1 rounded-xl uppercase tracking-wider">
                        Sin Stock
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-1.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-white line-clamp-1">{item.name}</h3>
                    {item.description && (
                      <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                        ✨ {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {outOfStock ? (
                        <span className="font-mono text-xs font-bold text-red-400 block">
                          Sin stock
                        </span>
                      ) : (
                        <>
                          <span className="font-mono text-sm font-black text-emerald-400 block">
                            {formatCurrency(displayPrice)}
                          </span>
                          {hasComboDiscount && (
                            <span className="font-mono text-[9px] text-slate-500 line-through">
                              {formatCurrency(item.sellPrice || item.price)}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <button
                      disabled={outOfStock}
                      onClick={() => addToCart(item)}
                      className={`p-2.5 rounded-xl transition ${
                        outOfStock 
                          ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                          : 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/40'
                      }`}
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredCatalog.length === 0 && (
            <div className="col-span-full bg-slate-900/50 border border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs">
              No encontramos bebidas ni combos para "{searchTerm}".
            </div>
          )}
        </div>
      </main>

      {processedCart.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              Seleccioná productos o combos de la izquierda para sumar a la venta.
            </p>
          ) : (
            processedCart.map((item) => {
              // 🚀 BUSGAMOS LOS NOMBRES REALES DE LOS PRODUCTOS DEL COMBO USANDO SU ID
              const comboComponents = (item.items || item.raw?.items || []).map((sub) => {
                const foundProd = products.find((p) => p.id === sub.productId);
                return {
                  qty: sub.quantity || sub.qty || 1,
                  name: foundProd ? foundProd.name : (sub.name || 'Producto')
                };
              });

              return (
                <div
                  key={`${item.id}-${item.type}`}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="truncate flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-100">{item.name}</span>
                        {comboComponents.length > 0 && (
                          <span className="text-[9px] bg-fuchsia-500/20 text-fuchsia-400 font-bold px-1.5 py-0.5 rounded border border-fuchsia-500/30">
                            Combo
                          </span>
                        )}
                        {item.isDiscountApplied && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                            Dto. Promo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="font-mono text-emerald-400 text-[11px] font-bold">
                          {formatCurrency(item.effectivePrice * item.qty)}
                        </span>
                        {item.isDiscountApplied && (
                          <span className="font-mono text-[10px] text-slate-500 line-through">
                            {formatCurrency(item.normalPrice * item.qty)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => updateQty(item.id, item.type === 'promo', -1)}
                        className="text-slate-400 hover:text-white px-1 font-bold"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-white px-1">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.type === 'promo', 1)}
                        className="text-slate-400 hover:text-white px-1 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 🚀 DESPLIEGUE SEGURO HACIA ABAJO (Muestra los nombres reales y nunca se corta) */}
                  {comboComponents.length > 0 && (
                    <div className="bg-slate-900/90 border border-fuchsia-500/30 rounded-xl p-2 space-y-1">
                      <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider">Contiene:</p>
                      {comboComponents.map((subItem, idx) => (
                        <div key={idx} className="text-[11px] text-slate-300 flex items-center gap-1.5 font-mono">
                          <span className="text-fuchsia-400">•</span> {subItem.qty}x {subItem.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}

      {showCartModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-fuchsia-400" /> Resumen de Tu Pedido
              </h3>
              <button onClick={() => setShowCartModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {processedCart.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">Tu carrito está vacío.</p>
              ) : (
                processedCart.map((item) => (
                  <div
                    key={`${item.id}-${item.type}`}
                    className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="truncate flex-1 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white truncate">{item.name}</span>
                        {item.isDiscountApplied && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                            Combo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <span className="font-mono text-emerald-400 font-bold">
                          {formatCurrency(item.price * item.qty)}
                        </span>
                        {item.isDiscountApplied && (
                          <span className="font-mono text-[10px] text-slate-500 line-through">
                            {formatCurrency(item.normalPrice * item.qty)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => updateQty(item.id, item.type === 'promo', -1)}
                        className="text-slate-400 hover:text-white px-1 font-bold"
                      >
                        -
                      </button>
                      <span className="font-mono font-bold text-white px-1">{item.qty}</span>
                      <button
                        onClick={() => updateQty(item.id, item.type === 'promo', 1)}
                        className="text-slate-400 hover:text-white px-1 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="bg-slate-950/60 p-2.5 rounded-2xl border border-slate-800 space-y-2 relative">
              <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> ¿Te falta algo? Agregalo acá:
              </span>
              <div className="grid grid-cols-2 gap-2 relative">
                
                <div className="relative">
                  <button
                    onClick={() => setShowIceSelector(!showIceSelector)}
                    className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl py-2 flex items-center justify-center gap-1.5 transition text-xs font-bold"
                  >
                    <span>🧊</span> Hielo (Elegir)
                  </button>

                  {showIceSelector && (
                    <div className="absolute bottom-full left-0 mb-2 w-full bg-slate-950 border border-sky-500/50 rounded-2xl p-2 shadow-2xl z-50 space-y-1.5 backdrop-blur-md animate-fadeIn">
                      <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-800">
                        <span className="text-[10px] font-bold text-sky-400 uppercase">Seleccioná Hielo:</span>
                        <button onClick={() => setShowIceSelector(false)} className="text-slate-400 hover:text-white">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {iceOptions.length === 0 ? (
                        <p className="text-[10px] text-slate-500 text-center py-2">No hay hielos disponibles.</p>
                      ) : (
                        iceOptions.map((ice) => {
                          const iceStock = Number(ice.stock ?? 0);
                          const isIceOut = iceStock <= 0;
                          const comboP = Number(ice.comboPrice || 0);
                          const normalP = Number(ice.sellPrice || ice.price || 0);
                          const isComboEligible = hasPromoInCart && comboP > 0;
                          const finalIcePrice = isComboEligible ? comboP : normalP;

                          return (
                            <button
                              key={ice.id}
                              disabled={isIceOut}
                              onClick={() => {
                                if (!isIceOut) {
                                  addToCart({ ...ice, isPromo: false });
                                  setShowIceSelector(false);
                                }
                              }}
                              className={`w-full text-left p-2 rounded-xl transition flex justify-between items-center text-xs border ${
                                isIceOut 
                                  ? 'bg-slate-950 opacity-50 border-slate-900 cursor-not-allowed' 
                                  : 'bg-slate-900 hover:bg-sky-500/20 border-slate-800 hover:border-sky-500/40'
                              }`}
                            >
                              <span className={`font-medium truncate pr-1 ${isIceOut ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                {ice.name}
                              </span>
                              <div className="text-right whitespace-nowrap">
                                {isIceOut ? (
                                  <span className="text-[10px] text-red-400 font-bold block">Sin stock</span>
                                ) : (
                                  <>
                                    <span className="font-mono text-emerald-400 font-bold block">
                                      {formatCurrency(finalIcePrice)}
                                    </span>
                                    {isComboEligible && (
                                      <span className="font-mono text-[9px] text-slate-500 line-through block">
                                        {formatCurrency(normalP)}
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleAddSuggested(['vaso'])}
                  className="w-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl py-2 flex items-center justify-center gap-1.5 transition text-xs font-bold"
                >
                  <span>🥤</span> Vaso 1L
                </button>
              </div>
            </div>

            <form onSubmit={handleSendOrder} className="space-y-3 pt-2 border-t border-slate-800 text-xs">
              <div>
                <label className="text-slate-300 block mb-1 font-bold flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-fuchsia-400" /> Tu Nombre / Apodo:
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white focus:outline-none focus:border-fuchsia-500"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1 font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> ¿Cómo vas a abonar?:
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => {
                    const mode = e.target.value;
                    setPaymentMethod(mode);
                    if (mode === 'Mixto') {
                      const half = Math.round(cartTotal / 2);
                      setPaidEfectivo(half.toString());
                      setPaidTransferencia((cartTotal - half).toString());
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white font-medium focus:outline-none focus:border-fuchsia-500"
                >
                  <option value="Efectivo">💵 Efectivo al entregar</option>
                  <option value="Transferencia">📲 Transferencia / Mercado Pago</option>
                  <option value="Mixto">🔀 Pago Mixto (Parte Efec + Parte Transf)</option>
                </select>
              </div>

              {/* 🚀 RETIRO O ENVÍO CON AVISO PROFESIONAL */}
              <div className="space-y-2 pt-1">
                <label className="text-slate-300 block font-bold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-fuchsia-400" /> Tipo de Entrega:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('retiro')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition text-xs ${
                      deliveryType === 'retiro'
                        ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300 shadow-md shadow-fuchsia-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${deliveryType === 'retiro' ? 'border-fuchsia-400 bg-fuchsia-500' : 'border-slate-600'}`}>
                      {deliveryType === 'retiro' && <span className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                    </span>
                    Retiro en Local
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryType('envio')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition text-xs ${
                      deliveryType === 'envio'
                        ? 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300 shadow-md shadow-fuchsia-500/10'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${deliveryType === 'envio' ? 'border-fuchsia-400 bg-fuchsia-500' : 'border-slate-600'}`}>
                      {deliveryType === 'envio' && <span className="w-1.5 h-1.5 bg-slate-950 rounded-full" />}
                    </span>
                    Envío a Domicilio
                  </button>
                </div>

                {deliveryType === 'envio' && (
                  <div className="space-y-2 pt-1 animate-fadeIn">
                    <input
                      required={deliveryType === 'envio'}
                      type="text"
                      placeholder="Ingresá tu dirección (Calle y número, depto)"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-slate-950 border border-fuchsia-500/40 rounded-xl p-2.5 text-white focus:outline-none focus:border-fuchsia-500"
                    />
                    <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 p-2.5 rounded-xl text-[11px] text-fuchsia-200 leading-relaxed">
                      🛵 <strong>Aviso de Envío:</strong> El costo de envío se calcula según la distancia (a partir de $1.500 en adelante según las cuadras). Se te confirmará al coordinar la entrega.
                    </div>
                  </div>
                )}
              </div>

              {paymentMethod === 'Mixto' && (
                <div className="bg-slate-950 p-3 rounded-2xl border border-fuchsia-500/40 space-y-2">
                  <span className="text-[11px] font-bold text-fuchsia-400 block uppercase">
                    Dividir Pago Mixto (Total: {formatCurrency(cartTotal)})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Monto Efectivo ($):</label>
                      <input
                        type="number"
                        step="any"
                        value={paidEfectivo}
                        onChange={(e) => handleEfectivoChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">Monto MP / Transf ($):</label>
                      <input
                        type="number"
                        step="any"
                        value={paidTransferencia}
                        onChange={(e) => handleTransferenciaChange(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-between items-center text-sm">
                <span className="font-bold text-slate-300 uppercase">TOTAL A PAGAR:</span>
                <span className="font-mono text-2xl font-black text-fuchsia-400">{formatCurrency(cartTotal)}</span>
              </div>

              <button
                type="submit"
                disabled={isSending || processedCart.length === 0}
                className="w-full bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 text-slate-950 font-bold py-3.5 rounded-2xl transition shadow-lg shadow-fuchsia-500/20 flex items-center justify-center gap-2 text-sm mt-2"
              >
                <Send className="w-5 h-5" /> {isSending ? 'Enviando...' : 'Enviar Pedido por WhatsApp'}
              </button>
            </form>
          </div>
        </div>
      )}

      {orderSentSuccess && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h3 className="font-bold text-lg text-white">¡Pedido Enviado! ✨</h3>
              <p className="text-xs text-slate-400 mt-1">
                Tu solicitud ya llegó a la caja de Benga Drinks. Te contactaremos enseguida para confirmar la entrega.
              </p>
            </div>

            <button
              onClick={() => setOrderSentSuccess(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-2xl text-xs transition"
            >
              Volver al Catálogo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}