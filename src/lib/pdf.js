import jsPDF from 'jspdf';
import 'jspdf-autotable';

const fmt = n => `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '';

// ── ORDEN DE DESPACHO (remisión media carta horizontal) ─────────────────────
function renderOrden(doc, pedido, items, config) {
  const W = 216, H = 140, M = 8;
  doc.setDrawColor(30, 126, 52);
  doc.setLineWidth(0.5);
  doc.rect(M, M, W-M*2, H-M*2);

  // Header verde
  doc.setFillColor(30, 126, 52);
  doc.rect(M, M, 70, 20, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(config.nombre_negocio||'Natilla Medellín', M+3, M+7);
  doc.setFontSize(7); doc.setFont('helvetica','normal');
  if(config.nit) doc.text('NIT: '+config.nit, M+3, M+12);
  doc.text(config.telefono||'', M+3, M+16);
  doc.text(config.email||'', M+3, M+19);

  // Número remisión
  doc.setFillColor(240,248,240);
  doc.rect(W-M-50, M, 50, 20, 'F');
  doc.setTextColor(30,126,52);
  doc.setFontSize(8); doc.setFont('helvetica','bold');
  doc.text('REMISIÓN', W-M-25, M+7, {align:'center'});
  doc.setFontSize(14);
  doc.text(`No. ${String(pedido.consecutivo).padStart(4,'0')}`, W-M-25, M+16, {align:'center'});

  // Fecha
  doc.setTextColor(90,90,90); doc.setFontSize(7); doc.setFont('helvetica','normal');
  const fr = new Date(pedido.fecha_registro||Date.now());
  doc.text(`Fecha: ${fr.getDate()}/${fr.getMonth()+1}/${fr.getFullYear()}`, W-M-50, M+22);

  // Datos cliente
  doc.setTextColor(30,30,30); doc.setFontSize(8);
  let y = M+27;
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

  // Tabla items
  doc.autoTable({
    startY: y+4,
    margin: {left:M+2, right:M+2},
    head:[['CANT.','DESCRIPCIÓN','VR. UNITARIO','VR. TOTAL']],
    body: items.map(i=>[i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
    foot:[['','','TOTAL $', fmt(items.reduce((s,i)=>s+(i.subtotal||0),0))]],
    styles:{fontSize:8, cellPadding:2},
    headStyles:{fillColor:[30,126,52], textColor:255, fontStyle:'bold'},
    footStyles:{fontStyle:'bold', fillColor:[240,248,240]},
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

export function imprimirOrdenes(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[216,140]});
  pedidos.forEach((p,i) => {
    if(i>0) doc.addPage([216,140],'landscape');
    renderOrden(doc, p, itemsPorPedido[p.id]||[], config);
  });
  doc.save(`Ordenes_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── COMANDA DE PRODUCCIÓN (media carta horizontal) ──────────────────────────
function renderComanda(doc, pedido, items, config) {
  const W = 216, H = 140, M = 8;
  doc.setDrawColor(30,126,52); doc.setLineWidth(0.5);
  doc.rect(M, M, W-M*2, H-M*2);

  doc.setFillColor(30,126,52);
  doc.rect(M, M, W-M*2, 16, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(12); doc.setFont('helvetica','bold');
  doc.text('COMANDA DE PRODUCCIÓN', W/2, M+7, {align:'center'});
  doc.setFontSize(8); doc.setFont('helvetica','normal');
  doc.text(config.nombre_negocio||'Natilla Medellín', W/2, M+13, {align:'center'});

  // Info pedido
  doc.setTextColor(30,30,30); doc.setFontSize(9);
  let y = M+22;
  doc.setFont('helvetica','bold');
  doc.text(`Pedido No. ${String(pedido.consecutivo).padStart(4,'0')}`, M+3, y);
  doc.setFont('helvetica','normal');
  doc.text(`Fecha entrega: ${fmtDate(pedido.fecha_entrega)}  Hora: ${pedido.hora_entrega?pedido.hora_entrega.slice(0,5):'-'}`, M+3, y+6);
  doc.text(`Cliente: ${pedido.nombre_empresa}`, M+3, y+12);

  doc.setDrawColor(200,200,200); doc.line(M+2, y+16, W-M-2, y+16);

  // Items
  doc.autoTable({
    startY: y+19,
    margin: {left:M+2, right:M+2},
    head:[['PRODUCTO','CANTIDAD']],
    body: items.map(i=>[i.nombre_producto, `${i.cantidad} und`]),
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

export function imprimirComandas(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const doc = new jsPDF({orientation:'landscape', unit:'mm', format:[216,140]});
  pedidos.forEach((p,i) => {
    if(i>0) doc.addPage([216,140],'landscape');
    renderComanda(doc, p, itemsPorPedido[p.id]||[], config);
  });
  doc.save(`Comandas_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── RECIBO DE CAJA (media carta vertical) ───────────────────────────────────
export function imprimirRecibos(pedidos, pagosPorPedido, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:[216,140]});
  pedidos.forEach((pedido,idx) => {
    if(idx>0) doc.addPage([216,140],'portrait');
    const W=216, M=10;
    const pagos = pagosPorPedido[pedido.id]||[];
    const items = itemsPorPedido[pedido.id]||[];
    const totalPedido = items.reduce((s,i)=>s+(i.subtotal||0),0);
    const totalPagado = pagos.reduce((s,p)=>s+(p.monto||0),0);
    const saldo = totalPedido - totalPagado;

    doc.setDrawColor(30,126,52); doc.setLineWidth(0.5);
    doc.rect(M, M, W-M*2, 120);

    doc.setFillColor(30,126,52);
    doc.rect(M, M, W-M*2, 16, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(12); doc.setFont('helvetica','bold');
    doc.text(config.nombre_negocio||'Natilla Medellín', W/2, M+7, {align:'center'});
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('RECIBO DE CAJA', W/2, M+13, {align:'center'});

    let y=M+22; doc.setTextColor(30,30,30); doc.setFontSize(8);
    const campo=(l,v)=>{ doc.setFont('helvetica','bold');doc.text(l,M+3,y);doc.setFont('helvetica','normal');doc.text(String(v||''),M+40,y);y+=6; };
    campo('No. Pedido:', `#${String(pedido.consecutivo).padStart(4,'0')}`);
    campo('Cliente:', pedido.nombre_empresa);
    campo('Teléfono:', pedido.telefono);
    campo('Entrega:', `${fmtDate(pedido.fecha_entrega)} ${pedido.hora_entrega?pedido.hora_entrega.slice(0,5):''}`);
    y+=2; doc.setDrawColor(220,220,220); doc.line(M+3,y,W-M-3,y); y+=4;
    doc.setFont('helvetica','bold'); doc.text('PRODUCTOS:', M+3, y); y+=5;
    items.forEach(i=>{ doc.setFont('helvetica','normal'); doc.text(`${i.cantidad}x ${i.nombre_producto}`, M+5, y); doc.text(fmt(i.subtotal), W-M-15, y, {align:'right'}); y+=5; });
    y+=2; doc.line(M+3,y,W-M-3,y); y+=5;
    doc.setFont('helvetica','bold'); doc.text('Total pedido:', M+3, y); doc.text(fmt(totalPedido), W-M-15, y, {align:'right'}); y+=6;
    pagos.forEach(p=>{ doc.setFont('helvetica','normal'); doc.text(`${p.tipo} (${p.metodo}):`, M+3, y); doc.text(fmt(p.monto), W-M-15, y, {align:'right'}); y+=5; });
    y+=2; doc.line(M+3,y,W-M-3,y); y+=5;
    doc.setFont('helvetica','bold');
    if(saldo>0){ doc.setTextColor(200,80,0); doc.text('Saldo pendiente:', M+3, y); doc.text(fmt(saldo), W-M-15, y, {align:'right'}); }
    else { doc.setTextColor(30,126,52); doc.text('PAGADO COMPLETO', W/2, y, {align:'center'}); }
    doc.setTextColor(150,150,150); doc.setFontSize(7); doc.setFont('helvetica','normal');
    doc.text(config.mensaje||'', W/2, M+128, {align:'center'});
  });
  doc.save(`Recibos_${new Date().toISOString().slice(0,10)}.pdf`);
}
