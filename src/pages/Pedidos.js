import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from '../hooks/useToast';
import { RefreshCw, Download, Search, X, Edit2, Save, Trash2, Printer, FileText, Receipt } from 'lucide-react';
import * as XLSX from 'xlsx';
import { imprimirOrdenes, imprimirComandas, imprimirCotizaciones, imprimirCuentasCobro } from '../lib/pdf';

const fmt = n => n ? `$${Number(n).toLocaleString('es-CO')}` : '-';
const fmtDate = d => d ? new Date(d+'T12:00').toLocaleDateString('es-CO') : '-';
const ESTADOS = ['Recibido','En producción','Despachado','Entregado','Cancelado'];
const ESTADO_BADGE = { 'Recibido':'badge-gray','En producción':'badge-amber','Despachado':'badge-blue','Entregado':'badge-green','Cancelado':'badge-red' };

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [items, setItems] = useState({});
  const [domiciliarios, setDomiciliarios] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [editItems, setEditItems] = useState([]);
  const [sel, setSel] = useState(new Set());
  const { toast, ToastContainer } = useToast();

  const [q, setQ] = useState('');
  const [fFechaReg, setFechaReg] = useState('');
  const [fFechaEnt, setFechaEnt] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fDom, setFDom] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: peds }, { data: doms }, { data: cfg }] = await Promise.all([
      supabase.from('pedidos').select('*, domiciliarios(nombre)').order('consecutivo', { ascending: false }),
      supabase.from('domiciliarios').select('*').eq('activo', true).order('nombre'),
      supabase.from('configuracion').select('*').limit(1).single(),
    ]);
    setPedidos(peds || []);
    setDomiciliarios(doms || []);
    setConfig(cfg || {});
    if (peds?.length) {
      const ids = peds.map(p => p.id);
      const { data: it } = await supabase.from('pedido_items').select('*').in('pedido_id', ids);
      const map = {};
      (it||[]).forEach(i => { if (!map[i.pedido_id]) map[i.pedido_id] = []; map[i.pedido_id].push(i); });
      setItems(map);
    } else {
      setItems({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Sin filtros = TODOS los pedidos. Los filtros solo restringen cuando se usan.
  const filtered = pedidos.filter(p => {
    const sq = q.toLowerCase();
    if (sq && !p.nombre_empresa?.toLowerCase().includes(sq) && !String(p.consecutivo).includes(sq) && !p.telefono?.includes(sq)) return false;
    if (fFechaReg && !p.fecha_registro?.startsWith(fFechaReg)) return false;
    if (fFechaEnt && p.fecha_entrega !== fFechaEnt) return false;
    if (fEstado && p.estado !== fEstado) return false;
    if (fDom && p.domiciliario_id !== fDom) return false;
    return true;
  });

  const totalConDomicilio = p => (items[p.id]||[]).reduce((s,i)=>s+(i.subtotal||0),0) + (parseFloat(p.domicilio)||0);
  const totalVentas = filtered.reduce((s, p) => s + totalConDomicilio(p), 0);

  const selPedidos = filtered.filter(p => sel.has(p.id));
  const toggleSel = id => setSel(s => { const ns=new Set(s); ns.has(id)?ns.delete(id):ns.add(id); return ns; });
  const toggleAll = () => sel.size===filtered.length ? setSel(new Set()) : setSel(new Set(filtered.map(p=>p.id)));

  const startEdit = p => {
    setEditId(p.id);
    setEditData({ ...p });
    setEditItems((items[p.id]||[]).map(i=>({...i})));
  };
  const cancelEdit = () => { setEditId(null); setEditData({}); setEditItems([]); };

  const saveEdit = async () => {
    const { error } = await supabase.from('pedidos').update({
      nombre_empresa: editData.nombre_empresa,
      nombre_contacto: editData.nombre_contacto,
      telefono: editData.telefono,
      direccion: editData.direccion,
      fecha_entrega: editData.fecha_entrega,
      hora_entrega: editData.hora_entrega,
      estado: editData.estado,
      domiciliario_id: editData.domiciliario_id || null,
      observaciones: editData.observaciones,
      domicilio: parseFloat(editData.domicilio) || 0,
    }).eq('id', editId);
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    for (const item of editItems) {
      const sub = (item.cantidad||0) * (item.precio_unitario||0);
      await supabase.from('pedido_items').update({ precio_unitario: item.precio_unitario||0, subtotal: sub }).eq('id', item.id);
    }
    toast('✅ Pedido actualizado');
    cancelEdit();
    fetchAll();
  };

  const eliminarPedido = async (id, consecutivo) => {
    if (!window.confirm(`¿Estás seguro de eliminar el pedido #${String(consecutivo).padStart(4,'0')}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('pedidos').delete().eq('id', id);
    if (error) { toast('Error al eliminar: ' + error.message, 'error'); return; }
    toast('🗑️ Pedido eliminado');
    setSel(s => { const ns = new Set(s); ns.delete(id); return ns; });
    fetchAll();
  };

  const exportarPedidosExcel = () => {
    const data = filtered.map(p => ({
      'No.': p.consecutivo,
      'Fecha Registro': p.fecha_registro ? new Date(p.fecha_registro).toLocaleDateString('es-CO') : '',
      'Fecha Entrega': p.fecha_entrega || '',
      'Empresa': p.nombre_empresa,
      'Contacto': p.nombre_contacto,
      'Teléfono': p.telefono,
      'Email': p.email || '',
      'Documento': `${p.tipo_documento||''} ${p.numero_documento||''}`,
      'Dirección': p.direccion,
      'Productos': (items[p.id]||[]).map(i=>`${i.cantidad}x ${i.nombre_producto}`).join(' | '),
      'Domicilio': p.domicilio || 0,
      'Total': totalConDomicilio(p),
      'Observaciones': p.observaciones || '',
      'Anticipo': p.tiene_anticipo ? 'Sí' : 'No',
      'Mensajero': p.domiciliarios?.nombre || '',
      'Estado': p.estado,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Pedidos');
    XLSX.writeFile(wb, `Pedidos_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarComandasExcel = () => {
    const rows = [];
    (selPedidos.length?selPedidos:filtered).forEach(p => {
      (items[p.id]||[]).forEach(i => rows.push({ 'No. Pedido': p.consecutivo, 'Empresa': p.nombre_empresa, 'Producto': i.nombre_producto, 'Cantidad': i.cantidad, 'F. Entrega': p.fecha_entrega, 'Hora': p.hora_entrega, 'Observaciones': p.observaciones||'' }));
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Comandas');
    XLSX.writeFile(wb, `Comandas_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const exportarOrdenesExcel = () => {
    const data = (selPedidos.length?selPedidos:filtered).map(p => ({
      'No.': p.consecutivo, 'Empresa': p.nombre_empresa, 'Dirección': p.direccion, 'Teléfono': p.telefono,
      'Productos': (items[p.id]||[]).map(i=>`${i.cantidad}x ${i.nombre_producto}`).join(' | '),
      'Domicilio': p.domicilio||0, 'Total': totalConDomicilio(p), 'Mensajero': p.domiciliarios?.nombre||'', 'Estado': p.estado,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Ordenes');
    XLSX.writeFile(wb, `Ordenes_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const accionMasiva = (fn, nombre) => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para procesar', 'error'); return; }
    fn(peds, items, config);
    toast(`✅ ${nombre} generado (${peds.length})`);
  };

  const accionMasivaConPagos = async (fn, nombre) => {
    const peds = selPedidos.length ? selPedidos : filtered;
    if (!peds.length) { toast('No hay pedidos para procesar', 'error'); return; }
    const { data: pagos } = await supabase.from('pagos').select('*').in('pedido_id', peds.map(p=>p.id));
    const pagosPorPedido = {};
    (pagos||[]).forEach(pg => { if(!pagosPorPedido[pg.pedido_id]) pagosPorPedido[pg.pedido_id]=[]; pagosPorPedido[pg.pedido_id].push(pg); });
    fn(peds, pagosPorPedido, items, config);
    toast(`✅ ${nombre} generado (${peds.length})`);
  };

  const clearFilters = () => { setQ(''); setFechaReg(''); setFechaEnt(''); setFEstado(''); setFDom(''); };
  const hasFilters = q || fFechaReg || fFechaEnt || fEstado || fDom;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Pedidos</div>
          <div className="page-sub">{filtered.length} de {pedidos.length} registros{sel.size>0 && ` · ${sel.size} seleccionados`}</div>
        </div>
        <div className="actions-row">
          <button className="btn" onClick={fetchAll}><RefreshCw size={13} /> Actualizar Data</button>
        </div>
      </div>

      {/* Botones de impresión y exportación */}
      <div className="actions-row" style={{marginBottom:14, flexWrap:'wrap'}}>
        <button className="btn btn-green" onClick={()=>accionMasiva(imprimirOrdenes,'Órdenes de despacho')}><Printer size={13}/> Órdenes Despacho</button>
        <button className="btn btn-green" onClick={()=>accionMasiva(imprimirComandas,'Comandas')}><FileText size={13}/> Imprimir Comanda</button>
        <button className="btn btn-green" onClick={()=>accionMasiva(imprimirCotizaciones,'Cotizaciones')}><Receipt size={13}/> Imprimir Cotización</button>
        <button className="btn btn-green" onClick={()=>accionMasivaConPagos(imprimirCuentasCobroWrapper,'Cuentas de cobro')}><Receipt size={13}/> Imprimir C. de Cobro</button>
        <span style={{width:1, background:'#dadce0', alignSelf:'stretch'}}></span>
        <button className="btn" onClick={exportarPedidosExcel}><Download size={13}/> Exportar Pedidos</button>
        <button className="btn" onClick={exportarComandasExcel}><Download size={13}/> Exportar Comandas</button>
        <button className="btn" onClick={exportarOrdenesExcel}><Download size={13}/> Exportar Órdenes</button>
      </div>

      <div className="stats">
        <div className="stat"><div className="stat-label">Total</div><div className="stat-val">{filtered.length}</div></div>
        <div className="stat"><div className="stat-label">Recibidos</div><div className="stat-val amber">{filtered.filter(p=>p.estado==='Recibido').length}</div></div>
        <div className="stat"><div className="stat-label">En producción</div><div className="stat-val amber">{filtered.filter(p=>p.estado==='En producción').length}</div></div>
        <div className="stat"><div className="stat-label">Entregados</div><div className="stat-val">{filtered.filter(p=>p.estado==='Entregado').length}</div></div>
        <div className="stat"><div className="stat-label">Total ventas</div><div className="stat-val text">{fmt(totalVentas)}</div></div>
      </div>

      <div className="filters">
        <div className="search-wrap">
          <Search className="search-icon" />
          <input placeholder="Buscar empresa, # pedido..." value={q} onChange={e => setQ(e.target.value)} style={{minWidth:200}} />
        </div>
        <div>
          <label style={{fontSize:10,color:'#9aa0a6',display:'block',marginBottom:2}}>Fecha del pedido</label>
          <input type="date" value={fFechaReg} onChange={e=>setFechaReg(e.target.value)} />
        </div>
        <div>
          <label style={{fontSize:10,color:'#9aa0a6',display:'block',marginBottom:2}}>Fecha de entrega</label>
          <input type="date" value={fFechaEnt} onChange={e=>setFechaEnt(e.target.value)} />
        </div>
        <select value={fEstado} onChange={e=>setFEstado(e.target.value)}>
          <option value="">Estado (todos)</option>
          {ESTADOS.map(s=><option key={s}>{s}</option>)}
        </select>
        <select value={fDom} onChange={e=>setFDom(e.target.value)}>
          <option value="">Mensajero (todos)</option>
          {domiciliarios.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
        {hasFilters && <button className="btn btn-ghost" onClick={clearFilters}><X size={13} /> Limpiar</button>}
      </div>

      {loading ? <div className="empty">Cargando pedidos…</div> :
       filtered.length === 0 ? <div className="empty">No hay pedidos con los filtros seleccionados.</div> : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th style={{width:32}}><input type="checkbox" checked={sel.size===filtered.length&&filtered.length>0} onChange={toggleAll} /></th>
                <th>#</th>
                <th>Empresa</th>
                <th>Contacto</th>
                <th>Productos</th>
                <th>F. Entrega</th>
                <th>Hora</th>
                <th>Domicilio</th>
                <th>Total</th>
                <th>Mensajero</th>
                <th>Estado</th>
                <th>Anticipo</th>
                <th>Observaciones</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const pit = items[p.id] || [];
                const totalProd = pit.reduce((s,i)=>s+(i.subtotal||0),0);
                if (editId === p.id) return (
                  <tr key={p.id} style={{background:'#f0fdf4'}}>
                    <td></td>
                    <td><span className="td-mono">{String(p.consecutivo).padStart(4,'0')}</span></td>
                    <td><input className="ie-input" value={editData.nombre_empresa||''} onChange={e=>setEditData(d=>({...d,nombre_empresa:e.target.value}))} /></td>
                    <td><input className="ie-input" value={editData.nombre_contacto||''} onChange={e=>setEditData(d=>({...d,nombre_contacto:e.target.value}))} /></td>
                    <td style={{minWidth:200}}>
                      {editItems.map((it,idx)=>(
                        <div key={it.id} style={{display:'flex',gap:4,alignItems:'center',marginBottom:3}}>
                          <span style={{fontSize:11,color:'#5f6368',minWidth:60}}>{it.cantidad}x {it.nombre_producto.slice(0,12)}</span>
                          <input className="ie-input" type="number" placeholder="Precio unit." value={it.precio_unitario||''} onChange={e=>setEditItems(ei=>ei.map((x,i)=>i===idx?{...x,precio_unitario:parseFloat(e.target.value)||0}:x))} style={{width:90}} />
                        </div>
                      ))}
                    </td>
                    <td><input className="ie-input" type="date" value={editData.fecha_entrega||''} onChange={e=>setEditData(d=>({...d,fecha_entrega:e.target.value}))} /></td>
                    <td><input className="ie-input" type="time" value={editData.hora_entrega||''} onChange={e=>setEditData(d=>({...d,hora_entrega:e.target.value}))} /></td>
                    <td><input className="ie-input" type="number" value={editData.domicilio||''} onChange={e=>setEditData(d=>({...d,domicilio:e.target.value}))} style={{width:80}} placeholder="0" /></td>
                    <td className="td-right">{fmt(editItems.reduce((s,i)=>s+(i.cantidad||0)*(i.precio_unitario||0),0) + (parseFloat(editData.domicilio)||0))}</td>
                    <td>
                      <select className="ie-input" value={editData.domiciliario_id||''} onChange={e=>setEditData(d=>({...d,domiciliario_id:e.target.value}))}>
                        <option value="">— sin asignar —</option>
                        {domiciliarios.map(d=><option key={d.id} value={d.id}>{d.nombre}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="ie-input" value={editData.estado||''} onChange={e=>setEditData(d=>({...d,estado:e.target.value}))}>
                        {ESTADOS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td-center">{p.tiene_anticipo?'Sí':'No'}</td>
                    <td style={{minWidth:150}}><input className="ie-input" value={editData.observaciones||''} onChange={e=>setEditData(d=>({...d,observaciones:e.target.value}))} placeholder="Observaciones" /></td>
                    <td>
                      <div className="actions-row">
                        <button className="btn btn-green" style={{padding:'4px 10px'}} onClick={saveEdit}><Save size={12} /></button>
                        <button className="btn" style={{padding:'4px 10px'}} onClick={cancelEdit}><X size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
                return (
                  <tr key={p.id} style={sel.has(p.id)?{background:'#f0fdf4'}:{}}>
                    <td><input type="checkbox" checked={sel.has(p.id)} onChange={()=>toggleSel(p.id)} /></td>
                    <td><span className="td-mono">{String(p.consecutivo).padStart(4,'0')}</span></td>
                    <td><div className="td-bold">{p.nombre_empresa}</div><div style={{fontSize:11,color:'#9aa0a6'}}>{p.telefono}</div></td>
                    <td>{p.nombre_contacto}</td>
                    <td style={{maxWidth:200}}>
                      {pit.map(i=><div key={i.id} style={{fontSize:12}}><span style={{background:'#e6f4ea',color:'#1a5c2a',borderRadius:3,padding:'1px 5px',fontSize:11,marginRight:4}}>{i.cantidad}</span>{i.nombre_producto}</div>)}
                    </td>
                    <td>{fmtDate(p.fecha_entrega)}</td>
                    <td>{p.hora_entrega?p.hora_entrega.slice(0,5):'-'}</td>
                    <td className="td-right">{p.domicilio > 0 ? fmt(p.domicilio) : '-'}</td>
                    <td className="td-right td-bold">{fmt(totalProd + (parseFloat(p.domicilio)||0))}</td>
                    <td>{p.domiciliarios?.nombre||'-'}</td>
                    <td><span className={`badge ${ESTADO_BADGE[p.estado]||'badge-gray'}`}>{p.estado}</span></td>
                    <td className="td-center">{p.tiene_anticipo?<span className="badge badge-green">Sí</span>:'No'}</td>
                    <td style={{maxWidth:150,fontSize:12,color:'#5f6368',fontStyle:p.observaciones?'italic':'normal'}}>{p.observaciones||'-'}</td>
                    <td>
                      <div className="actions-row">
                        <button className="btn" style={{padding:'4px 10px'}} onClick={()=>startEdit(p)} title="Editar"><Edit2 size={12} /></button>
                        <button className="btn btn-danger" style={{padding:'4px 10px'}} onClick={()=>eliminarPedido(p.id, p.consecutivo)} title="Eliminar"><Trash2 size={12} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ToastContainer />
    </div>
  );

  function imprimirCuentasCobroWrapper(peds, pagosPorPedido, itemsArg, cfg) {
    imprimirCuentasCobro(peds, itemsArg, cfg);
  }
}
