import jsPDF from 'jspdf';
import 'jspdf-autotable';

const fmt = n => `$${Number(n||0).toLocaleString('es-CO')}`;
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '';
const totalPedido = (items, domicilio) => items.reduce((s,i)=>s+(i.subtotal||0),0) + (parseFloat(domicilio)||0);

// ── ORDEN DE DESPACHO (remisión media carta horizontal) ─────────────────────
function renderOrden(doc, pedido, items, config) {
  const W = 216, H = 140, M = 8;
  doc.setDrawColor(30, 126, 52);
  doc.setLineWidth(0.5);
  doc.rect(M, M, W-M*2, H-M*2);

  doc.setFillColor(30, 126, 52);
  doc.rect(M, M, 70, 20, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(11); doc.setFont('helvetica','bold');
  doc.text(config.nombre_negocio||'Natilla Medellín', M+3, M+7);
  doc.setFontSize(7); doc.setFont('helvetica','normal');
  if(config.nit) doc.text('NIT: '+config.nit, M+3, M+12);
  doc.text(config.telefono||'', M+3, M+16);
  doc.text(config.email||'', M+3, M+19);

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

  const body = items.map(i=>[i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]);
  const foot = [];
  if (pedido.domicilio > 0) foot.push(['','','Domicilio', fmt(pedido.domicilio)]);
  foot.push(['','','TOTAL $', fmt(totalPedido(items, pedido.domicilio))]);

  doc.autoTable({
    startY: y+4,
    margin: {left:M+2, right:M+2},
    head:[['CANT.','DESCRIPCIÓN','VR. UNITARIO','VR. TOTAL']],
    body, foot,
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

  doc.setTextColor(30,30,30); doc.setFontSize(9);
  let y = M+22;
  doc.setFont('helvetica','bold');
  doc.text(`Pedido No. ${String(pedido.consecutivo).padStart(4,'0')}`, M+3, y);
  doc.setFont('helvetica','normal');
  doc.text(`Fecha entrega: ${fmtDate(pedido.fecha_entrega)}  Hora: ${pedido.hora_entrega?pedido.hora_entrega.slice(0,5):'-'}`, M+3, y+6);
  doc.text(`Cliente: ${pedido.nombre_empresa}`, M+3, y+12);

  doc.setDrawColor(200,200,200); doc.line(M+2, y+16, W-M-2, y+16);

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
    const totalConDom = totalPedido(items, pedido.domicilio);
    const totalPagado = pagos.reduce((s,p)=>s+(p.monto||0),0);
    const saldo = totalConDom - totalPagado;

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
    if (pedido.domicilio > 0) { doc.text('Domicilio', M+5, y); doc.text(fmt(pedido.domicilio), W-M-15, y, {align:'right'}); y+=5; }
    y+=2; doc.line(M+3,y,W-M-3,y); y+=5;
    doc.setFont('helvetica','bold'); doc.text('Total pedido:', M+3, y); doc.text(fmt(totalConDom), W-M-15, y, {align:'right'}); y+=6;
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

// ── COTIZACIÓN (carta vertical) ─────────────────────────────────────────────
export function imprimirCotizaciones(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  pedidos.forEach((pedido, idx) => {
    if (idx>0) doc.addPage('letter','portrait');
    const M = 20;
    const items = itemsPorPedido[pedido.id] || [];
    let y = M;

    doc.setTextColor(30,126,52); doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.text(config.nombre_negocio||'Natilla Medellín', M, y);
    y += 5;
    doc.setFontSize(9); doc.setTextColor(120,120,120); doc.setFont('helvetica','normal');
    doc.text(config.mensaje||'Calidad, frescura y cumplimiento', M, y);
    y += 14;

    doc.setTextColor(30,30,30); doc.setFontSize(10);
    const fecha = new Date(pedido.fecha_registro||Date.now());
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    doc.text(`Medellín, ${fecha.getDate()} de ${meses[fecha.getMonth()]} de ${fecha.getFullYear()}`, M, y);
    y += 10;
    doc.setFont('helvetica','bold'); doc.text('Cliente:', M, y); doc.setFont('helvetica','normal'); doc.text(pedido.nombre_empresa||'', M+22, y);
    y += 12;

    doc.setFont('helvetica','bold'); doc.setFontSize(12);
    doc.text('COTIZACIÓN', M, y);
    y += 10;

    doc.autoTable({
      startY: y,
      margin: {left:M, right:M},
      head:[['CANT.','PRODUCTO','VR. UNITARIO','VR. TOTAL']],
      body: items.map(i=>[i.cantidad, i.nombre_producto, fmt(i.precio_unitario), fmt(i.subtotal)]),
      foot: [
        ...(pedido.domicilio>0 ? [['','','Valor domicilio', fmt(pedido.domicilio)]] : [['','','Envío','Gratis']]),
        ['','','TOTAL', fmt(totalPedido(items, pedido.domicilio))],
      ],
      styles:{fontSize:10, cellPadding:4},
      headStyles:{fillColor:[30,126,52], textColor:255, fontStyle:'bold'},
      footStyles:{fontStyle:'bold', fillColor:[240,248,240]},
      columnStyles:{0:{cellWidth:22,halign:'center'},2:{cellWidth:40,halign:'right'},3:{cellWidth:40,halign:'right'}},
    });

    let fy = doc.lastAutoTable.finalY + 14;
    doc.setFontSize(9); doc.setFont('helvetica','normal'); doc.setTextColor(80,80,80);
    doc.text('- Somos persona natural (no somos responsables de IVA)', M, fy); fy += 6;
    doc.text(`- Envío: ${pedido.domicilio>0 ? fmt(pedido.domicilio) : 'Gratis'}`, M, fy); fy += 20;

    doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(30,30,30);
    doc.text(config.nombre_negocio||'', M, fy); fy += 5;
    if (config.nit) { doc.text(`NIT. ${config.nit}`, M, fy); fy += 5; }
    if (config.telefono) { doc.text(`Cel. ${config.telefono}`, M, fy); }
  });
  doc.save(`Cotizacion_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── CUENTA DE COBRO (carta vertical) ────────────────────────────────────────
export function imprimirCuentasCobro(pedidos, itemsPorPedido, config) {
  if(!pedidos.length) return;
  const doc = new jsPDF({orientation:'portrait', unit:'mm', format:'letter'});
  pedidos.forEach((pedido, idx) => {
    if (idx>0) doc.addPage('letter','portrait');
    const W = 216, M = 25;
    const items = itemsPorPedido[pedido.id] || [];
    const total = totalPedido(items, pedido.domicilio);
    let y = M;

    doc.setTextColor(30,126,52); doc.setFontSize(20); doc.setFont('helvetica','bold');
    doc.text(config.nombre_negocio||'Natilla Medellín', W/2, y, {align:'center'});
    y += 5;
    doc.setFontSize(9); doc.setTextColor(120,120,120); doc.setFont('helvetica','normal');
    doc.text(config.mensaje||'Calidad, frescura y cumplimiento', W/2, y, {align:'center'});
    y += 20;

    doc.setTextColor(30,30,30); doc.setFontSize(13); doc.setFont('helvetica','bold');
    doc.text('CUENTA DE COBRO', W/2, y, {align:'center'});
    y += 12;

    const fecha = new Date(pedido.fecha_registro||Date.now());
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`${meses[fecha.getMonth()]} ${fecha.getDate()} de ${fecha.getFullYear()}`, W/2, y, {align:'center'});
    y += 16;

    doc.setFont('helvetica','bold'); doc.text('Debe a:', W/2, y, {align:'center'}); y += 6;
    doc.setFont('helvetica','normal'); doc.text(pedido.nombre_empresa||'', W/2, y, {align:'center'}); y += 6;
    if (pedido.numero_documento) { doc.text(`${pedido.tipo_documento||'Doc.'}: ${pedido.numero_documento}`, W/2, y, {align:'center'}); y += 6; }
    y += 14;

    const numeroEnLetras = fmt(total);
    doc.setFont('helvetica','bold'); doc.setFontSize(11);
    doc.text(`LA SUMA DE: ${numeroEnLetras}`, M, y, {maxWidth: W-M*2}); y += 7;
    const conceptoLineas = items.map(i=>`${i.cantidad}x ${i.nombre_producto}`).join(', ');
    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(`POR CONCEPTO DE: ${conceptoLineas}${pedido.domicilio>0?' + domicilio':''}`, M, y, {maxWidth: W-M*2});
    y += 24;

    doc.setFontSize(9);
    doc.text('NO SOMOS RESPONSABLES DE IVA', M, y);
    y += 20;

    doc.setFont('helvetica','normal'); doc.setFontSize(10);
    doc.text(config.nombre_negocio||'', M, y); y += 5;
    if (config.nit) { doc.text(`NIT. ${config.nit}`, M, y); y += 5; }
    if (config.telefono) { doc.text(`Cel. ${config.telefono}`, M, y); }
  });
  doc.save(`CuentaCobro_${new Date().toISOString().slice(0,10)}.pdf`);
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
    'Domicilio': p.domicilio || 0,
    'Estado': p.estado || '',
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pedidosData), 'Pedidos');
  XLSX.writeFile(wb, `Natilla_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
