import jsPDF from 'jspdf';
import 'jspdf-autotable';

const fmt = n => `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '';

// ── Convertir número a letras en español (pesos colombianos) ───────────────
const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const DECENAS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const ESPECIALES = { 10:'diez',11:'once',12:'doce',13:'trece',14:'catorce',15:'quince',16:'dieciséis',17:'diecisiete',18:'dieciocho',19:'diecinueve',21:'veintiuno',22:'veintidós',23:'veintitrés',24:'veinticuatro',25:'veinticinco',26:'veintiséis',27:'veintisiete',28:'veintiocho',29:'veintinueve' };
const CENTENAS = ['', 'cien', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function convertirGrupo(n) {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  let resultado = '';
  const c = Math.floor(n / 100);
  const resto = n % 100;
  if (c > 0) resultado += CENTENAS[c] + ' ';
  if (ESPECIALES[resto]) {
    resultado += ESPECIALES[resto];
  } else {
    const d = Math.floor(resto / 10);
    const u = resto % 10;
    if (d > 0) {
      resultado += DECENAS[d];
      if (u > 0) resultado += ' y ' + UNIDADES[u];
    } else if (u > 0) {
      resultado += UNIDADES[u];
    }
  }
  return resultado.trim();
}

function numeroALetras(num) {
  num = Math.round(num);
  if (num === 0) return 'cero pesos';
  const millones = Math.floor(num / 1000000);
  const miles = Math.floor((num % 1000000) / 1000);
  const resto = num % 1000;
  let partes = [];
  if (millones > 0) partes.push((millones === 1 ? 'un millón' : convertirGrupo(millones) + ' millones'));
  if (miles > 0) {
    let textoMiles = convertirGrupo(miles);
    textoMiles = textoMiles.replace(/^uno$/, 'un').replace(/veintiuno$/, 'veintiún');
    partes.push(miles === 1 ? 'mil' : textoMiles + ' mil');
  }
  if (resto > 0) partes.push(convertirGrupo(resto));
  let texto = partes.join(' ').trim();
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  return texto + ' pesos ML';
}

// Nombre de archivo: si es 1 solo pedido, incluye el nombre de la empresa.
// Si son varios, usa "Lote" + fecha.
function nombreArchivo(prefijo, pedidos) {
  const fecha = new Date().toISOString().slice(0,10);
  if (pedidos.length === 1) {
    const limpio = (pedidos[0].nombre_empresa || 'Cliente')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita tildes
      .replace(/[^a-zA-Z0-9]+/g, '') // solo letras y números
      .slice(0, 40);
    return `${prefijo}_${limpio}.pdf`;
  }
  return `${prefijo}_Lote_${fecha}.pdf`;
}

// El domicilio ya no es una columna aparte: es un item más dentro de pedido_items
// (nombre_producto = 'Domicilio'). El total es simplemente la suma de todos los items.
const totalPedido = (items) => items.reduce((s,i)=>s+(i.subtotal||0),0);

// ── Utilidad: precargar imágenes remotas como dataURL para poder ────────────
// ── insertarlas dentro del PDF (jsPDF requiere datos locales/base64) ───────
const imageCache = new Map();
async function loadImageDataUrl(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    imageCache.set(url, dataUrl);
    return dataUrl;
  } catch (e) {
    console.warn('No se pudo cargar imagen:', url);
    return null;
  }
}
function detectFormat(dataUrl) {
  if (!dataUrl) return 'JPEG';
  if (dataUrl.startsWith('data:image/png')) return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}
// Calcula ancho/alto proporcional para que el logo no se deforme al insertarlo
function getImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.width, h: img.height });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}
function fitBox(natW, natH, maxSize) {
  const ratio = natW / natH;
  if (ratio >= 1) return { w: maxSize, h: maxSize / ratio };
  return { w: maxSize * ratio, h: maxSize };
}

// ── Encabezado uniforme para TODOS los documentos ───────────────────────────
// Precarga el logo una sola vez (llamar await antes de generar cualquier PDF)
async function prepararLogo(config) {
  if (!config.logo_url) return null;
  const dataUrl = await loadImageDataUrl(config.logo_url);
  if (!dataUrl) return null;
  const dim = await getImageDimensions(dataUrl);
  const box = fitBox(dim.w, dim.h, 14);
  return { dataUrl, format: detectFormat(dataUrl), box };
}

// Dibuja: [logo] Nombre negocio / NIT / dirección / tel · email — compacto.
// Devuelve el "y" final para continuar el documento debajo del encabezado.
function renderHeader(doc, config, logo, x, y, fontScale = 1) {
  const startY = y;
  if (logo) {
    try { doc.addImage(logo.dataUrl, logo.format, x, y - logo.box.h * 0.65, logo.box.w, logo.box.h); } catch(e) {}
  }
  const xTexto = logo ? x + logo.box.w + 3 : x;
  doc.setTextColor(30,126,52); doc.setFont('helvetica','bold'); doc.setFontSize(11 * fontScale);
  doc.text(config.nombre_negocio || 'Natilla Medellín', xTexto, y);
  y += 4 * fontScale;
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5 * fontScale); doc.setTextColor(90,90,90);
  if (config.nit) { doc.text(`NIT: ${config.nit}`, xTexto, y); y += 3.4 * fontScale; }
  if (config.direccion) { doc.text(config.direccion, xTexto, y); y += 3.4 * fontScale; }
  if (config.telefono || config.email) { doc.text(`${config.telefono||''}  ${config.email||''}`, xTexto, y); y += 3.4 * fontScale; }
  const logoBottom = logo ? startY - logo.box.h * 0.65 + logo.box.h : startY;
  return Math.max(y, logoBottom) + 2;
}

const dimCache = new Map();
async function preloadAllImages(urls) {
  const unicas = [...new Set(urls.filter(Boolean))];
  await Promise.all(unicas.map(async (url) => {
    const dataUrl = await loadImageDataUrl(url);
    if (dataUrl) dimCache.set(url, await getImageDimensions(dataUrl));
  }));
}

// ── ORDEN DE DESPACHO (remisión media carta horizontal) ─────────────────────
function renderOrden(doc, pedido, items, config, logo) {
  const W = 216, H = 140, M = 8;
  doc.setDrawColor(30, 126, 52);
  doc.setLineWidth(0.5);
  doc.rect(M, M, W-M*2, H-M*2);

  renderHeader(doc, config, logo, M+2, M+6);

  doc.setFillColor(240,248,240);
  doc.rect(W-M-50, M, 50, 20, 'F');
  doc.setTextColor(30,126,52);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('REMISIÓN', W-M-25, M+7, {align:'center'});
  doc.setFontSize(14);
  doc.text(`No. ${String(pedido.consecutivo).padStart(4,'0')}`, W-M-25, M+16, {align:'center'});

  doc.setTextColor(90,90,90); doc.setFontSize(7); doc.setFont('helvetica','normal');
  const fr = new Date(pedido.fecha_registro||Date.now());
  doc.text(`Fecha: ${fr.getDate()}/${fr.getMonth()+1}/${fr.getFullYear()}`, W-M-50, M+22);

  doc.setTextColor(30,30,30); doc.setFontSize(8);
  let y = M+25;
  doc.setFont('helvetica','bold'); doc.text('SEÑOR(ES):', M+2, y);
  doc.setFont('helvetica','normal'); doc.text(pedido.nombre_empresa||'', M+24, y);
  y+=5;
  doc.setFont('helvetica','bold'); doc.text('DIRECCIÓN:', M+2, y);
  doc.setFont('helvetica','normal'); doc.text(pedido.direccion||'', M+24, y);
  y+=5;
  doc.setFont('helvetica','bold'); doc.text('TEL:', M+2, y);
  doc.setFont('helvetica','normal'); doc.text(pedido.telefono||'', M+12, y);
  doc.setFont('helvetica','bold'); doc.text('ENTREGA:', M+55, y);
  doc.setFont('helvetica','normal');
  doc.text(`${fmtDate(pedido.fecha_entrega)} ${pedido.hora_entrega?pedido.hora_entrega.slice(0,5):''}`, M+75, y);

  const body = items.map(i=>[i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]);

  doc.autoTable({
    startY: y+4,
    margin: {left:M+2, right:M+2},
    head:[['CANT.','DESCRIPCIÓN','VR. UNITARIO','VR. TOTAL']],
    body,
    foot: [['','','TOTAL $', fmt(totalPedido(items))]],
    styles:{fontSize:8, cellPadding:2},
    headStyles:{fillColor:[30,126,52], textColor:255, fontStyle:'bold'},
    footStyles:{fontStyle:'bold', fillColor:[240,248,240], textColor:[30,30,30]},
    columnStyles:{0:{cellWidth:18,halign:'center'},2:{cellWidth:32,halign:'right'},3:{cellWidth:32,halign:'right'}},
  });

  const ay = doc.lastAutoTable.finalY+4;
  doc.setFontSize(7.5); doc.setTextColor(30,30,30);
  doc.setFont('helvetica','bold'); doc.text('DESPACHADO POR:', M+2, ay);
  doc.line(M+30, ay, M+70, ay);
  doc.text('MENSAJERO:', M+75, ay);
  doc.setFont('helvetica','normal');
  doc.text(pedido.domiciliarios?.nombre||'', M+95, ay);
  doc.setFont('helvetica','bold'); doc.text('RECIBIDO POR:', M+2, ay+6);
  doc.line(M+27, ay+6, M+70, ay+6);
  doc.setFont('helvetica','normal');
  doc.text(pedido.tiene_anticipo?'Con anticipo':'Sin anticipo', M+75, ay+6);

  if(config.mensaje){
    doc.setFontSize(6.5); doc.setTextColor(120,120,120);
    doc.text(config.mensaje, W/2, H-M-2, {align:'center'});
  }
}

export async function imprimirOrdenes(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[216,140]});
  pedidos.forEach((p,i) => {
    if(i>0) doc.addPage([216,140],'landscape');
    renderOrden(doc, p, itemsPorPedido[p.id]||[], config, logo);
  });
  doc.save(nombreArchivo('Orden', pedidos));
}

// ── COMANDA DE PRODUCCIÓN (media carta horizontal) ──────────────────────────
// No incluye el item "Domicilio": la comanda es solo para cocina/producción.
function renderComanda(doc, pedido, items, config, logo) {
  const itemsProduccion = items.filter(i => i.nombre_producto !== 'Domicilio');
  const W = 216, H = 140, M = 8;
  doc.setDrawColor(30,126,52); doc.setLineWidth(0.5);
  doc.rect(M, M, W-M*2, H-M*2);

  renderHeader(doc, config, logo, M+2, M+6);

  doc.setFillColor(240,248,240);
  doc.rect(W-M-50, M, 50, 20, 'F');
  doc.setTextColor(30,126,52);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('COMANDA', W-M-25, M+7, {align:'center'});
  doc.setFontSize(13);
  doc.text(`No. ${String(pedido.consecutivo).padStart(4,'0')}`, W-M-25, M+16, {align:'center'});

  doc.setTextColor(30,30,30); doc.setFontSize(9);
  let y = M+25;
  doc.setFont('helvetica','bold');
  doc.text('COMANDA DE PRODUCCIÓN', M+3, y);
  doc.setFont('helvetica','normal');
  doc.text(`Fecha entrega: ${fmtDate(pedido.fecha_entrega)}  Hora: ${pedido.hora_entrega?pedido.hora_entrega.slice(0,5):'-'}`, M+3, y+6);
  doc.text(`Cliente: ${pedido.nombre_empresa}`, M+3, y+12);

  doc.setDrawColor(200,200,200); doc.line(M+2, y+16, W-M-2, y+16);

  doc.autoTable({
    startY: y+19,
    margin: {left:M+2, right:M+2},
    head:[['PRODUCTO','CANTIDAD']],
    body: itemsProduccion.map(i=>[i.nombre_producto, `${i.cantidad} und`]),
    styles:{fontSize:9, cellPadding:3},
    headStyles:{fillColor:[240,248,240], textColor:[30,126,52], fontStyle:'bold'},
    columnStyles:{1:{halign:'center', cellWidth:40, fontStyle:'bold', textColor:[30,126,52]}},
  });

  const ay = doc.lastAutoTable.finalY+5;
  if(pedido.observaciones){
    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(180,120,0);
    doc.text('OBSERVACIONES:', M+3, ay);
    doc.setFont('helvetica','normal'); doc.setTextColor(30,30,30);
    doc.text(pedido.observaciones, M+3, ay+5);
  }
}

export async function imprimirComandas(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[216,140]});
  pedidos.forEach((p,i) => {
    if(i>0) doc.addPage([216,140],'landscape');
    renderComanda(doc, p, itemsPorPedido[p.id]||[], config, logo);
  });
  doc.save(nombreArchivo('Comanda', pedidos));
}

// ── RECIBO DE CAJA — ultra compacto, tipo POS, media carta vertical ─────────
export async function imprimirRecibos(pedidos, pagosPorPedido, itemsPorPedido, config) {
  if(!pedidos.length) return;

  const logo = await prepararLogo(config);

  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:[140,216]});

  pedidos.forEach((pedido, idx) => {
    if(idx>0) doc.addPage([140,216],'portrait');
    const W=140, M=6;
    const pagos = pagosPorPedido[pedido.id]||[];
    const items = itemsPorPedido[pedido.id]||[];
    const total = totalPedido(items);
    const totalPagado = pagos.reduce((s,p)=>s+(p.monto||0),0);
    const saldo = total - totalPagado;

    let y = renderHeader(doc, config, logo, M, M+6, 0.82);

    doc.setDrawColor(30,126,52); doc.setLineWidth(0.4);
    doc.line(M, y, W-M, y); y += 4;

    doc.setFontSize(8); doc.setFont('helvetica','bold'); doc.setTextColor(30,126,52);
    doc.text('RECIBO DE CAJA', M, y);
    doc.text(`No. ${String(pedido.consecutivo).padStart(4,'0')}`, W-M, y, {align:'right'});
    y += 4.5;

    // Datos del cliente en tabla de 2 columnas — mucho más compacto en vertical
    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      theme: 'grid',
      body: [
        [`NIT/CC: ${pedido.tipo_documento||''} ${pedido.numero_documento||''}`, `Fecha Generación: ${fmtDate(new Date().toISOString().slice(0,10))}`],
        [`Cliente: ${pedido.nombre_empresa||''}`, `Dirección: ${pedido.direccion||''}`],
        [`Contacto: ${pedido.nombre_contacto||''}`, `F. entrega: ${fmtDate(pedido.fecha_entrega)}`],
        [`Tel. recibe: ${pedido.telefono||''}`, `Hora: ${pedido.hora_entrega?pedido.hora_entrega.slice(0,5):''}`],
      ],
      styles: { fontSize:6.2, cellPadding:1.6, textColor:[30,30,30], lineColor:[220,220,220], lineWidth:0.2 },
      columnStyles: { 0:{cellWidth:(W-M*2)/2}, 1:{cellWidth:(W-M*2)/2} },
    });
    y = doc.lastAutoTable.finalY + 4;

    // Tabla ultra compacta
    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      head: [['CANT','DESCRIPCIÓN','P.UNIT','TOTAL']],
      body: items.map(i => [i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      styles:{ fontSize:6.5, cellPadding:1.2, textColor:[30,30,30] },
      headStyles:{ fillColor:[30,126,52], textColor:255, fontStyle:'bold', fontSize:6.5 },
      columnStyles:{
        0:{cellWidth:9, halign:'center'},
        1:{cellWidth:'auto'},
        2:{cellWidth:18, halign:'right'},
        3:{cellWidth:20, halign:'right'},
      },
      tableWidth: W-M*2,
    });

    y = doc.lastAutoTable.finalY + 3;
    doc.setDrawColor(30,126,52); doc.line(M, y, W-M, y); y += 4;

    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(30,126,52);
    doc.text('TOTAL:', M, y);
    doc.text(fmt(total), W-M, y, {align:'right'});
    y += 5;

    if (pagos.length) {
      doc.setFontSize(6.8); doc.setTextColor(30,30,30); doc.setFont('helvetica','bold');
      doc.text('PAGOS:', M, y); y += 3.4;
      doc.setFont('helvetica','normal');
      pagos.forEach(p => {
        const tipoMostrar = p.tipo === 'Pago Normal' ? 'Pago Total' : p.tipo;
        doc.text(`- ${p.metodo} (${tipoMostrar}): ${fmt(p.monto)}`, M+1, y, {maxWidth: W-M*2-2});
        y += 3.4;
      });
      y += 1;
    }

    doc.setDrawColor(220,220,220); doc.line(M, y, W-M, y); y += 4.5;
    doc.setFont('helvetica','bold'); doc.setFontSize(8.5);
    if (saldo > 0) {
      doc.setTextColor(200,80,0);
      doc.text('SALDO:', M, y);
      doc.text(fmt(saldo), W-M, y, {align:'right'});
    } else {
      doc.setTextColor(30,126,52);
      doc.text('PAGADO COMPLETO', W/2, y, {align:'center'});
    }

    const mensajeLimpio = (config.mensaje||'').replace(/^\/+/, '').trim();
    if (mensajeLimpio) {
      doc.setTextColor(150,150,150); doc.setFontSize(6); doc.setFont('helvetica','normal');
      doc.text(mensajeLimpio, W/2, 216-M, {align:'center', maxWidth: W-M*2});
    }
  });

  doc.save(nombreArchivo('Recibo', pedidos));
}

// ── COTIZACIÓN — con imagen pequeña por producto y paginación ──────────────
export async function imprimirCotizaciones(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;

  // Precargar todas las imágenes de productos que aparecen en estos pedidos
  const todasLasUrls = pedidos.flatMap(p => (itemsPorPedido[p.id]||[]).map(i => i.imagen_url));
  await preloadAllImages(todasLasUrls);
  const logo = await prepararLogo(config);

  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  const PAGE_H = 279;

  pedidos.forEach((pedido, idx) => {
    if (idx>0) doc.addPage('letter','portrait');
    const startPage = doc.internal.getNumberOfPages();
    const M = 18;
    const items = itemsPorPedido[pedido.id] || [];

    let y = renderHeader(doc, config, logo, M, M+8, 1.3);
    y += 4;

    doc.setTextColor(30,30,30); doc.setFontSize(9.5);
    const fecha = new Date(pedido.fecha_registro||Date.now());
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    doc.text(`Medellín, ${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`, M, y);
    y += 8;
    doc.setFont('helvetica','bold'); doc.text('Cliente:', M, y); doc.setFont('helvetica','normal'); doc.text(pedido.nombre_empresa||'', M+20, y);
    y += 10;

    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text('COTIZACIÓN', M, y);
    y += 8;

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M, bottom: 20},
      head:[['','CANT.','PRODUCTO','VR. UNITARIO','VR. TOTAL']],
      body: items.map(i=>['', i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      foot: [['','','','TOTAL', fmt(totalPedido(items))]],
      styles:{fontSize:9, cellPadding:3, minCellHeight:9},
      headStyles:{fillColor:[30,126,52], textColor:255, fontStyle:'bold'},
      footStyles:{fontStyle:'bold', fillColor:[240,248,240], textColor:[30,30,30]},
      columnStyles:{
        0:{cellWidth:11},
        1:{cellWidth:16,halign:'center'},
        3:{cellWidth:32,halign:'right'},
        4:{cellWidth:32,halign:'right'},
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const item = items[data.row.index];
          const dataUrl = item && imageCache.get(item.imagen_url);
          const dim = item && dimCache.get(item.imagen_url);
          if (dataUrl) {
            try {
              const box = dim ? fitBox(dim.w, dim.h, 7) : {w:7,h:7};
              doc.addImage(dataUrl, detectFormat(dataUrl), data.cell.x + (data.cell.width-box.w)/2, data.cell.y + (data.cell.height-box.h)/2, box.w, box.h);
            } catch(e) {}
          }
        }
      },
    });

    let fy = doc.lastAutoTable.finalY + 12;
    if (fy > PAGE_H - 40) { doc.addPage('letter','portrait'); fy = M; }
    doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text('- Somos persona natural (no somos responsables de IVA)', M, fy); fy += 14;

    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(30,30,30);
    doc.text(config.nombre_negocio||'', M, fy); fy += 5;
    if (config.nit) { doc.text(`NIT. ${config.nit}`, M, fy); fy += 5; }
    if (config.telefono) { doc.text(`Cel. ${config.telefono}`, M, fy); }

    // Numeración "Hoja X de Y" — solo relativa a las páginas de ESTA cotización
    const endPage = doc.internal.getNumberOfPages();
    const totalPaginasPedido = endPage - startPage + 1;
    if (totalPaginasPedido > 1) {
      for (let pg = startPage; pg <= endPage; pg++) {
        doc.setPage(pg);
        doc.setFontSize(8); doc.setTextColor(140,140,140); doc.setFont('helvetica','normal');
        doc.text(`Hoja ${pg-startPage+1} de ${totalPaginasPedido}`, 216/2, PAGE_H-10, {align:'center'});
      }
    }
  });

  doc.save(nombreArchivo('Cotizacion', pedidos));
}

// ── CUENTA DE COBRO (carta vertical) ────────────────────────────────────────
export async function imprimirCuentasCobro(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const logo = await prepararLogo(config);
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  pedidos.forEach((pedido, idx) => {
    if (idx>0) doc.addPage('letter','portrait');
    const M = 22;
    const items = itemsPorPedido[pedido.id] || [];
    const total = totalPedido(items);

    let y = renderHeader(doc, config, logo, M, M+8, 1.3);
    y += 6;

    doc.setTextColor(30,30,30); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('CUENTA DE COBRO', 216/2, y, {align:'center'});
    y += 9;

    const fecha = new Date(pedido.fecha_registro||Date.now());
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`${meses[fecha.getMonth()]} ${fecha.getDate()} de ${fecha.getFullYear()}`, 216/2, y, {align:'center'});
    y += 12;

    // Datos del cliente (quien debe pagar)
    doc.setFontSize(9.5); doc.setTextColor(30,30,30);
    doc.setFont('helvetica','bold'); doc.text('NIT/CC Cliente:', M, y);
    doc.setFont('helvetica','normal'); doc.text(`${pedido.tipo_documento||''} ${pedido.numero_documento||''}`, M+38, y);
    y += 6;
    doc.setFont('helvetica','bold'); doc.text('Nombre Cliente:', M, y);
    doc.setFont('helvetica','normal'); doc.text(pedido.nombre_empresa||'', M+38, y);
    y += 14;

    // "Debe a" — siempre fijo, datos del negocio que recibe el pago
    doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('Debe a:', 216/2, y, {align:'center'}); y += 6;
    doc.setFont('helvetica','normal');
    doc.text('PAULA ANDREA GUTIERREZ SANTAMARIA', 216/2, y, {align:'center'}); y += 5.5;
    doc.text('NATILLA MEDELLIN', 216/2, y, {align:'center'}); y += 5.5;
    doc.text(`NIT. ${config.nit || '43.749.223-8'}`, 216/2, y, {align:'center'}); y += 14;

    // La suma de — en letras y números
    doc.setTextColor(30,126,52); doc.setFont('helvetica','bold'); doc.setFontSize(12);
    doc.text(`LA SUMA DE: ${numeroALetras(total)} (${fmt(total)})`, M, y, {maxWidth: 216-M*2}); y += 12;

    doc.setTextColor(30,30,30); doc.setFont('helvetica','bold'); doc.setFontSize(10);
    doc.text('POR CONCEPTO DE:', M, y); y += 6;

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      head: [['CANT.', 'PRODUCTO', 'VALOR UNITARIO', 'VALOR TOTAL']],
      body: items.map(i => [i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      foot: [['', '', 'TOTAL', fmt(total)]],
      styles: { fontSize: 9.5, cellPadding: 3 },
      headStyles: { fillColor:[30,126,52], textColor:255, fontStyle:'bold' },
      footStyles: { fontStyle:'bold', fillColor:[240,248,240], textColor:[30,30,30] },
      columnStyles: { 0:{cellWidth:22,halign:'center'}, 2:{cellWidth:38,halign:'right'}, 3:{cellWidth:38,halign:'right'} },
    });

    let fy = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text('NO SOMOS RESPONSABLES DE IVA', M, fy);
    fy += 18;

    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(30,30,30);
    doc.text(config.nombre_negocio||'', M, fy); fy += 5;
    if (config.nit) { doc.text(`NIT. ${config.nit}`, M, fy); fy += 5; }
    if (config.telefono) { doc.text(`Cel. ${config.telefono}`, M, fy); }
  });
  doc.save(nombreArchivo('CuentaCobro', pedidos));
}

// ── Exportar Excel de toda la base de datos ─────────────────────────────────
export function exportarExcel(pedidos, pagos) {
  const XLSX = window.XLSX || require('xlsx');
  const pedidosData = pedidos.map(p => ({
    'No.': p.consecutivo,
    'Fecha Registro': p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString('es-CO') : '',
    'Fecha Entrega': p.fecha_entrega || '',
    'Empresa': p.nombre_empresa,
    'Contacto': p.nombre_contacto,
    'Teléfono': p.telefono,
    'Dirección': p.direccion,
    'Observaciones': p.observaciones || '',
    'Estado': p.estado || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pedidosData), 'Pedidos');
  XLSX.writeFile(wb, `Natilla_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
