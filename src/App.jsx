import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import {
  Search,
  Plus,
  Trash2,
  Download,
  Share2,
  X,
  Sparkles,
  ShoppingBag,
  MapPin,
  UserCheck,
  DollarSign,
  Receipt,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { formatCurrency } from '../utils';

// 🚀 FUNCIÓN DE OPTIMIZACIÓN DE IMÁGENES AL VUELO
const getOptimizedImageUrl = (url) => {
  if (!url) return '';
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&q=75`;
};

export default function SalesTab({
  products = [],
  promos = [],
  clients = [],
  onRegisterSale,
  notify,
  prefilledOrder
}) {
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedClient, setSelectedClient] = useState('Cliente Casual');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [paidEfectivoInput, setPaidEfectivoInput] = useState('');
  const [paidTransferenciaInput, setPaidTransferenciaInput] = useState('');
  const [address, setAddress] = useState('');
  const [shippingFeeInput, setShippingFeeInput] = useState('');
  const [driverExtraInput, setDriverExtraInput] = useState('');

  // 🧊 ESTADO PARA LA MINI PESTAÑITA DE SELECCIÓN DE HIELO
  const [showIceSelector, setShowIceSelector] = useState(false);

  // 🚀 ESTADO PARA CONTROLAR QUÉ COMBOS TIENEN EL DESPLEGABLE ABIERTO EN EL CARRITO
  const [expandedCombos, setExpandedCombos] = useState({});

  // TICKET VISUAL
  const [ticketModalData, setTicketModalData] = useState(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef(null);

  // AUTO-CARGAR PEDIDO PROVENIENTE DE LA WEB DEL CLIENTE O DE REABRIR VENTA
  useEffect(() => {
    if (prefilledOrder) {
      if (prefilledOrder.items && prefilledOrder.items.length > 0) {
        setCart(prefilledOrder.items);
      }
      if (prefilledOrder.clientName) {
        setSelectedClient(prefilledOrder.clientName);
      }
      if (prefilledOrder.paymentMethod) {
        setPaymentMethod(prefilledOrder.paymentMethod);
        if (prefilledOrder.paymentMethod === 'Mixto') {
          setPaidEfectivoInput((prefilledOrder.paidEfectivo || 0).toString());
          setPaidTransferenciaInput((prefilledOrder.paidTransferencia || 0).toString());
        }
      }
      if (prefilledOrder.address) {
        setAddress(prefilledOrder.address);
      }
    }
  }, [prefilledOrder]);

  // 🛡️ LECTOR SEGURO DE STOCK Y VALIDACIÓN DE PROMOS (Única fuente de verdad)
  const getSafeStock = (val) => {
    if (val === undefined || val === null || val === '') return 0;
    const num = parseInt(val, 10);
    return isNaN(num) ? 0 : num;
  };

  const isPromoOutOfStock = (promo) => {
    if (!promo.items || promo.items.length === 0) return false;
    return promo.items.some((comp) => {
      const pObj = products.find((p) => p.id === comp.productId);
      return !pObj || getSafeStock(pObj.stock) < Number(comp.quantity || 1);
    });
  };

  // CATEGORÍAS
  const categories = useMemo(() => {
    const cats = Array.from(new Set(products.map((p) => p.category))).filter(Boolean);
    return ['Todas', '🔥 Promos & Combos', ...cats];
  }, [products]);

  // FILTRADO CON BÚSQUEDA DENTRO DE COMBOS
  const filteredCatalog = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const promoMatches = (pr) => {
      if (!pr.active) return false;
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

  // DETECTAR SI HAY PROMO EN EL CARRITO
  const hasPromoInCart = useMemo(() => {
    return cart.some((item) => item.type === 'promo' || item.isPromo);
  }, [cart]);

  // APLICAR DESCUENTO P. COMBO DINÁMICAMENTE
  const processedCart = useMemo(() => {
    return cart.map((item) => {
      if (item.type === 'product' || !item.isPromo) {
        const comboP = Number(item.raw?.comboPrice || item.comboPrice || 0);
        const normalP = Number(item.raw?.sellPrice || item.raw?.price || item.sellPrice || item.price || 0);

        const isDiscountApplied = hasPromoInCart && comboP > 0;
        const effectivePrice = isDiscountApplied ? comboP : normalP;

        return {
          ...item,
          effectivePrice,
          normalPrice: normalP,
          isDiscountApplied
        };
      }
      return {
        ...item,
        effectivePrice: Number(item.price || 0),
        isDiscountApplied: false
      };
    });
  }, [cart, hasPromoInCart]);

  // CÁLCULOS
  const shippingFee = parseFloat(shippingFeeInput) || 0;
  const driverExtra = parseFloat(driverExtraInput) || 0;
  const itemsTotal = processedCart.reduce((acc, i) => acc + i.effectivePrice * i.qty, 0);
  const cartCostTotal = processedCart.reduce((acc, i) => acc + i.cost * i.qty, 0);
  const cartTotal = itemsTotal + shippingFee;

  const handleEfectivoChange = (val) => {
    setPaidEfectivoInput(val);
    const num = parseFloat(val) || 0;
    const remaining = Math.max(0, cartTotal - num);
    setPaidTransferenciaInput(remaining > 0 ? remaining.toString() : '0');
  };

  const handleTransferenciaChange = (val) => {
    setPaidTransferenciaInput(val);
    const num = parseFloat(val) || 0;
    const remaining = Math.max(0, cartTotal - num);
    setPaidEfectivoInput(remaining > 0 ? remaining.toString() : '0');
  };

  const addToCart = (item) => {
    if (item.isPromo) {
      if (isPromoOutOfStock(item)) {
        alert('Este combo no se puede seleccionar porque uno o más productos se encuentran sin stock.');
        return;
      }
    } else {
      const freshProduct = products.find((p) => p.id === item.id);
      const currentStock = getSafeStock(freshProduct?.stock ?? item.stock ?? 0);

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

      // 🚀 CAPTURAR CORRECTAMENTE LOS COMPONENTES (DESDE PROMO O RAW)
      const rawItems = item.items || item.raw?.items || [];

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
          items: rawItems,
          raw: item
        }
      ];
    });
  };

  // 🚀 FUNCIÓN DE AGREGADO RÁPIDO (UPSELL) PARA VASO
  const handleAddSuggested = (keywords) => {
    const foundProduct = products.find(p =>
      keywords.some(kw => (p.name || '').toLowerCase().includes(kw))
    );

    if (foundProduct) {
      addToCart({ ...foundProduct, isPromo: false });
      notify(`✨ ${foundProduct.name} sumado al pedido`);
    } else {
      notify(`⚠️ No se encontró "${keywords[0]}" en el catálogo`);
    }
  };

  // 🧊 LISTA DE HIELOS DISPONIBLES EN TU INVENTARIO
  const iceOptions = useMemo(() => {
    return products.filter(p => (p.name || '').toLowerCase().includes('hielo') || (p.category || '').toLowerCase().includes('hielo'));
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

  const handleSubmitSale = () => {
    if (processedCart.length === 0) return;

    if (paymentMethod === 'Fiado' && selectedClient === 'Cliente Casual') {
      notify('⚠️ Para fiar, seleccioná un cliente específico de la lista');
      return;
    }

    let paidEfectivo = 0;
    let paidTransferencia = 0;

    if (paymentMethod === 'Efectivo') {
      paidEfectivo = cartTotal;
    } else if (paymentMethod === 'Transferencia') {
      paidTransferencia = cartTotal;
    } else if (paymentMethod === 'Mixto') {
      paidEfectivo = parseFloat(paidEfectivoInput) || 0;
      paidTransferencia = parseFloat(paidTransferenciaInput) || 0;

      if (Math.abs((paidEfectivo + paidTransferencia) - cartTotal) > 0.01) {
        notify(`⚠️ La suma de Efectivo ($${paidEfectivo}) y Transferencia ($${paidTransferencia}) debe dar el total ($${cartTotal})`);
        return;
      }
    }

    const salePayload = {
      saleCart: processedCart.map(item => ({ ...item, price: item.effectivePrice })),
      selectedClient,
      paymentMethod,
      paidEfectivo,
      paidTransferencia,
      address,
      shippingFee,
      driverExtra,
      cartTotal,
      cartCostTotal,
      clearCart: () => {
        setCart([]);
        setAddress('');
        setShippingFeeInput('');
        setDriverExtraInput('');
        setPaidEfectivoInput('');
        setPaidTransferenciaInput('');
        setPaymentMethod('Efectivo');
      }
    };

    onRegisterSale(salePayload);

    setTicketModalData({
      ticketId: `V-${Date.now().toString().slice(-4)}`,
      date: new Date().toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      client: selectedClient,
      paymentMethod,
      paidEfectivo,
      paidTransferencia,
      address,
      items: processedCart.map(item => ({ ...item, price: item.effectivePrice })),
      shippingFee,
      total: cartTotal
    });
  };

  const handleDownloadImage = async () => {
    if (!ticketRef.current) return;
    setIsGeneratingImage(true);
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `Ticket-BengaDrinks-${ticketModalData.ticketId}.png`;
      link.href = dataUrl;
      link.click();
      notify('📸 Imagen del ticket descargada');
    } catch (err) {
      notify('⚠️ No se pudo generar la imagen');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareImage = async () => {
    if (!ticketRef.current) return;
    setIsGeneratingImage(true);
    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true, pixelRatio: 2 });
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `Ticket-BengaDrinks-${ticketModalData.ticketId}.png`, {
        type: 'image/png'
      });

      const clientName = ticketModalData.client;
      const customText = clientName && clientName !== 'Cliente Casual'
        ? `¡Muchas gracias, ${clientName}! 🙌🍹 Acá te dejo el ticket de tu pedido ✨`
        : `¡Muchas gracias! 🙌🍹 Acá te dejo tu ticket ✨`;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Ticket de Compra - Benga Drinks',
          text: customText
        });
      } else {
        handleDownloadImage();
      }
    } catch (err) {
      handleDownloadImage();
    } finally {
      setIsGeneratingImage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
      {/* LADO IZQUIERDO: CATÁLOGO DE TARJETAS VISUALES */}
      <div className="lg:col-span-7 space-y-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar fernet, vodka, hielo, combos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-fuchsia-500 transition"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition border ${
                  selectedCategory === cat
                    ? 'bg-fuchsia-500 text-slate-950 border-fuchsia-400 shadow-md shadow-fuchsia-500/20'
                    : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* GRILLA VISUAL DE PRODUCTOS/PROMOS CON FOTO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[580px] overflow-y-auto pr-1">
          {filteredCatalog.map((item) => {
            const comboP = Number(item.comboPrice || item.raw?.comboPrice || 0);
            const isComboEligible = !item.isPromo && hasPromoInCart && comboP > 0;
            const displayPrice = item.isPromo
              ? item.price
              : (isComboEligible ? comboP : (item.sellPrice || item.price));

            const outOfStock = item.isPromo 
              ? isPromoOutOfStock(item) 
              : getSafeStock(item.stock) <= 0;

            return (
              <div
                key={`${item.isPromo ? 'pr' : 'prod'}-${item.id}`}
                onClick={() => {
                  if (outOfStock) return;
                  addToCart(item);
                }}
                className={`border rounded-2xl overflow-hidden transition flex flex-col justify-between group shadow-lg relative ${
                  outOfStock
                    ? 'bg-slate-950/40 border-slate-800/50 opacity-60 cursor-not-allowed grayscale'
                    : item.isPromo
                    ? 'bg-fuchsia-950/20 border-fuchsia-500/40 hover:border-fuchsia-400 cursor-pointer hover:scale-[1.02]'
                    : 'bg-slate-900/80 border-slate-800 hover:border-fuchsia-500/50 cursor-pointer hover:scale-[1.02]'
                }`}
              >
                <div className="h-28 bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800/80">
                  {outOfStock && (
                    <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-slate-900/90 border border-slate-700 text-slate-300 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-xl">
                        SIN STOCK
                      </span>
                    </div>
                  )}

                  {item.imageUrl ? (
                    <img
                      src={getOptimizedImageUrl(item.imageUrl)}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      crossOrigin="anonymous"
                      onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = item.imageUrl;
                      }}
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
                    />
                  ) : (
                    <div className="text-slate-700 flex flex-col items-center gap-1">
                      <ImageIcon className="w-8 h-8 stroke-[1.5]" />
                      <span className="text-[9px] uppercase font-bold text-slate-600">Sin Foto</span>
                    </div>
                  )}
                  <span className="absolute top-1.5 left-1.5 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-bold uppercase text-fuchsia-400 border border-slate-800 z-10">
                    {item.isPromo ? '🔥 Promo' : item.brand}
                  </span>
                </div>

                <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-xs text-slate-100 group-hover:text-fuchsia-400 line-clamp-1">
                      {item.name}
                    </h3>
                    {item.description && (
                      <p className="text-[10px] text-slate-400 line-clamp-1">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      {outOfStock ? (
                        <span className="font-mono text-xs font-bold text-slate-500 block">
                          Sin stock
                        </span>
                      ) : (
                        <>
                          <span className="font-mono text-xs font-black text-emerald-400 block">
                            {formatCurrency(displayPrice)}
                          </span>
                          {isComboEligible && (
                            <span className="font-mono text-[9px] text-slate-500 line-through">
                              {formatCurrency(item.sellPrice || item.price)}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center transition shadow ${
                      outOfStock
                        ? 'bg-slate-800/40 text-slate-600'
                        : 'bg-slate-800 group-hover:bg-fuchsia-500 group-hover:text-slate-950 text-slate-300'
                    }`}>
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredCatalog.length === 0 && (
            <div className="col-span-full bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center text-slate-500 text-xs">
              No se encontraron bebidas ni combos que coincidan con "{searchTerm}".
            </div>
          )}
        </div>
      </div>

      {/* LADO DERECHO: VENTA Y PAGO */}
      <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-xl relative">
        <div className="flex justify-between items-center pb-3 border-b border-slate-800">
          <h2 className="font-bold text-base text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-fuchsia-400" /> Venta Actual
          </h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-xs text-red-400 hover:underline">
              Vaciar
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {processedCart.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              Seleccioná productos o combos de la izquierda para sumar a la venta.
            </p>
          ) : (
            processedCart.map((item, index) => {
              // 🚀 CRUZAR IDs CON NOMBRES REALES DE PRODUCTOS
              const comboComponents = (item.items || []).map((sub) => {
                const foundProd = products.find((p) => p.id === sub.productId);
                return {
                  qty: sub.quantity || sub.qty || 1,
                  name: foundProd ? foundProd.name : (sub.name || sub.productId)
                };
              });

              const isExpanded = !!expandedCombos[index];

              return (
                <div
                  key={`${item.id}-${item.type}-${index}`}
                  className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="truncate flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-100">{item.name}</span>
                        
                        {comboComponents.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedCombos((prev) => ({ ...prev, [index]: !prev[index] }))
                            }
                            className="text-[10px] bg-fuchsia-500/20 text-fuchsia-300 font-bold px-2 py-0.5 rounded-lg border border-fuchsia-500/40 flex items-center gap-1 hover:bg-fuchsia-500/30 transition cursor-pointer"
                          >
                            <span>Ver combo</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        )}

                        {item.isDiscountApplied && (
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/30">
                            Dto. Promo
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
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

                  {/* 🚀 CAJA DESPLEGABLE CON LOS NOMBRES REALES DE LO QUE CONTIENE */}
                  {comboComponents.length > 0 && isExpanded && (
                    <div className="bg-slate-900/90 border border-fuchsia-500/30 rounded-xl p-2.5 space-y-1 animate-fadeIn">
                      <p className="text-[10px] text-fuchsia-400 font-bold uppercase tracking-wider">Contiene:</p>
                      {comboComponents.map((subItem, subIdx) => (
                        <div key={subIdx} className="text-[11px] text-slate-200 flex items-center gap-1.5 font-mono">
                          <span className="text-fuchsia-400">•</span> {subItem.qty}x {subItem.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1 font-medium flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-fuchsia-400" /> Cliente:
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-fuchsia-500"
              >
                <option value="Cliente Casual">Cliente Casual</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1 font-medium flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Medio de Pago:
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => {
                  const mode = e.target.value;
                  setPaymentMethod(mode);
                  if (mode === 'Mixto') {
                    const half = Math.round(cartTotal / 2);
                    setPaidEfectivoInput(half.toString());
                    setPaidTransferenciaInput((cartTotal - half).toString());
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-medium focus:outline-none focus:border-fuchsia-500"
              >
                <option value="Efectivo">💵 Efectivo</option>
                <option value="Transferencia">💳 Transferencia / MP</option>
                <option value="Mixto">🔀 Pago Mixto (Efectivo + MP)</option>
                <option value="Fiado">📝 Fiado (Deuda)</option>
              </select>
            </div>
          </div>

          {paymentMethod === 'Mixto' && (
            <div className="bg-slate-950/90 p-3 rounded-2xl border border-fuchsia-500/40 space-y-2 animate-fadeIn">
              <span className="text-[11px] font-bold text-fuchsia-400 block uppercase">
                Dividir Pago Mixto (Total: {formatCurrency(cartTotal)})
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Monto en Efectivo ($):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={paidEfectivoInput}
                    onChange={(e) => handleEfectivoChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-xs focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Monto MP / Transf ($):</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={paidTransferenciaInput}
                    onChange={(e) => handleTransferenciaChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-white font-mono text-xs focus:outline-none focus:border-fuchsia-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-400 block mb-1 font-medium flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-fuchsia-400" /> Dirección de Envío (Opcional):
            </label>
            <input
              type="text"
              placeholder="Ej: Calle San Martín 1234, Dpto 2B"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Costo Envío ($):</label>
              <input
                type="number"
                placeholder="0"
                value={shippingFeeInput}
                onChange={(e) => setShippingFeeInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1 font-medium">Extra Delivery ($):</label>
              <input
                type="number"
                placeholder="0"
                value={driverExtraInput}
                onChange={(e) => setDriverExtraInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white font-mono"
              />
            </div>
          </div>

          {/* SUGERIDOS RÁPIDOS (UPSELL) */}
          <div className="pt-3 border-t border-slate-800 space-y-2 relative">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Sugeridos Rápidos (Upsell)
            </span>
            <div className="grid grid-cols-2 gap-2 relative">
              <div className="relative">
                <button
                  onClick={() => setShowIceSelector(!showIceSelector)}
                  className="w-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl py-2 flex flex-col items-center justify-center gap-1 transition"
                  title="Seleccionar Hielo"
                >
                  <span className="text-base">🧊</span>
                  <span className="text-[10px] font-bold">Hielo (Elegir)</span>
                </button>

                {showIceSelector && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-slate-950 border border-sky-500/50 rounded-2xl p-2.5 shadow-2xl z-50 space-y-2 backdrop-blur-md animate-fadeIn">
                    <div className="flex justify-between items-center px-1 pb-1 border-b border-slate-800">
                      <span className="text-[10px] font-bold text-sky-400 uppercase">Elegí el tipo de Hielo:</span>
                      <button onClick={() => setShowIceSelector(false)} className="text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {iceOptions.length === 0 ? (
                      <p className="text-[10px] text-slate-500 text-center py-2">No hay hielos cargados en el inventario.</p>
                    ) : (
                      iceOptions.map((ice) => {
                        const comboP = Number(ice.comboPrice || 0);
                        const normalP = Number(ice.sellPrice || ice.price || 0);
                        const isComboEligible = hasPromoInCart && comboP > 0;
                        const finalIcePrice = isComboEligible ? comboP : normalP;

                        return (
                          <button
                            key={ice.id}
                            onClick={() => {
                              addToCart({ ...ice, isPromo: false });
                              setShowIceSelector(false);
                              notify(`🧊 ${ice.name} sumado al pedido`);
                            }}
                            className="w-full text-left bg-slate-900 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-500/40 p-2 rounded-xl transition flex justify-between items-center text-xs"
                          >
                            <span className="font-medium text-slate-200 truncate pr-1">{ice.name}</span>
                            <div className="text-right whitespace-nowrap">
                              <span className="font-mono text-emerald-400 font-bold block">
                                {formatCurrency(finalIcePrice)}
                              </span>
                              {isComboEligible && (
                                <span className="font-mono text-[9px] text-slate-500 line-through block">
                                  {formatCurrency(normalP)}
                                </span>
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
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl py-2 flex flex-col items-center justify-center gap-1 transition"
                title="Agregar Vaso 1L"
              >
                <span className="text-base">🥤</span>
                <span className="text-[10px] font-bold">Vaso 1L</span>
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-800 mt-3">
            <span className="text-xs text-slate-400 uppercase font-bold">Total a Cobrar:</span>
            <span className="font-mono text-2xl font-bold text-fuchsia-400">
              {formatCurrency(cartTotal)}
            </span>
          </div>

          <button
            disabled={processedCart.length === 0}
            onClick={handleSubmitSale}
            className="w-full bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-bold py-3.5 rounded-2xl transition shadow-lg shadow-fuchsia-500/20 flex items-center justify-center gap-2"
          >
            <Sparkles className="w-5 h-5" /> Registrar y Generar Ticket
          </button>
        </div>
      </div>

      {/* MODAL TICKET FOTO */}
      {ticketModalData && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-fuchsia-400" /> Ticket Digital Generado
              </h3>
              <button onClick={() => setTicketModalData(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl shadow-2xl">
              <div
                ref={ticketRef}
                className="bg-slate-950 text-slate-100 p-5 font-mono text-xs space-y-4 border border-fuchsia-500/30"
              >
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-800">
                  <div className="font-black text-base tracking-wider text-fuchsia-400">BENGA DRINKS</div>
                  <div className="text-[10px] text-slate-400 uppercase">Venta de Bebidas</div>
                  <div className="text-[9px] text-slate-500 pt-1">Ticket #{ticketModalData.ticketId} • {ticketModalData.date}</div>
                </div>

                <div className="space-y-1 text-[11px] pb-3 border-b border-dashed border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cliente:</span>
                    <strong className="text-white">{ticketModalData.client}</strong>
                  </div>
                  <div className="flex justify-between items-start">
                    <span className="text-slate-400">Pago:</span>
                    <strong className="text-emerald-400 text-right">
                      {ticketModalData.paymentMethod === 'Mixto' ? (
                        <>
                          <span>Mixto</span>
                          <span className="block text-[9px] text-slate-300 font-mono">
                            Efec: {formatCurrency(ticketModalData.paidEfectivo)} | MP: {formatCurrency(ticketModalData.paidTransferencia)}
                          </span>
                        </>
                      ) : (
                        ticketModalData.paymentMethod
                      )}
                    </strong>
                  </div>
                  {ticketModalData.address && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Envío a:</span>
                      <strong className="text-slate-200 truncate max-w-[150px]">{ticketModalData.address}</strong>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pb-3 border-b border-dashed border-slate-800">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Detalle:</span>
                  {ticketModalData.items.map((item, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex justify-between">
                        <span>{item.qty}x {item.name}</span>
                        <span className="font-bold">{formatCurrency(item.price * item.qty)}</span>
                      </div>
                      {item.raw?.description && (
                        <div className="text-[9px] text-fuchsia-300 pl-2">
                          + {item.raw.description}
                        </div>
                      )}
                    </div>
                  ))}

                  {ticketModalData.shippingFee > 0 && (
                    <div className="flex justify-between text-slate-400 pt-1">
                      <span>Costo de Envío</span>
                      <span>{formatCurrency(ticketModalData.shippingFee)}</span>
                    </div>
                  )}
                </div>

                <div className="pt-1 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-300">TOTAL:</span>
                  <span className="text-fuchsia-400 text-base">{formatCurrency(ticketModalData.total)}</span>
                </div>

                <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-dashed border-slate-800">
                  ¡Muchas gracias por tu preferencia! ✨
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                disabled={isGeneratingImage}
                onClick={handleShareImage}
                className="w-full bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-slate-800 text-slate-950 font-bold py-3 rounded-2xl transition shadow-lg shadow-fuchsia-500/20 flex items-center justify-center gap-2 text-xs"
              >
                <Share2 className="w-4 h-4" /> Compartir Foto / Enviar
              </button>

              <button
                disabled={isGeneratingImage}
                onClick={handleDownloadImage}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold py-3 rounded-2xl transition flex items-center justify-center gap-2 text-xs"
              >
                <Download className="w-4 h-4" /> Descargar Imagen PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}